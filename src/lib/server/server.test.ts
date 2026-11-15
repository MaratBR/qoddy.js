import { beforeEach, describe, expect, it } from 'vitest';
import { open, Invalid, type Db } from './db.ts';
import {
	authenticate,
	createSession,
	createUser,
	deleteSession,
	sessionUser,
	signUp,
	type User
} from './accounts.ts';
import { getSettings, setSetting, updateSettings } from './settings.ts';
import {
	addThought,
	browseThoughts,
	createCollection,
	deleteCollection,
	deleteThought,
	findCollection,
	importCsv,
	updateThought
} from './collections.ts';
import { parseSyncRequest, sync, type Lock, type MineItem } from './sync.ts';

let db: Db;
beforeEach(() => {
	db = open(':memory:');
});

const defaultId = () => findCollection(db, 'default')!.id;

describe('accounts', () => {
	it('signs up, authenticates and keeps sessions', async () => {
		const user = await signUp(db, {
			email: ' Ada@Example.com ',
			name: 'Ada',
			password: 'long enough'
		});
		expect(user).toMatchObject({ email: 'ada@example.com', role: 'user' });
		await expect(
			signUp(db, { email: 'ada@example.com', name: 'A', password: 'long enough' })
		).rejects.toThrow(Invalid);
		expect(await authenticate(db, 'ADA@example.com', 'long enough')).toMatchObject({ id: user.id });
		expect(await authenticate(db, 'ada@example.com', 'wrong password')).toBeNull();
		expect(await authenticate(db, 'nobody@example.com', 'long enough')).toBeNull();

		const { token } = createSession(db, user.id);
		expect(sessionUser(db, token)?.user.id).toBe(user.id);
		expect(sessionUser(db, token + 'x')).toBeNull();
		deleteSession(db, token);
		expect(sessionUser(db, token)).toBeNull();
	});

	it('starts an account in the browser’s language and codes failures for the app', async () => {
		const ru = await signUp(db, { email: 'r@x.y', name: 'R', password: '12345678', locale: 'ru' });
		expect(ru.locale).toBe('ru');
		const odd = await signUp(db, { email: 'o@x.y', name: 'O', password: '12345678', locale: 'xx' });
		expect(odd.locale).toBeNull();
		await expect(
			signUp(db, { email: 'a@b.c', name: 'A', password: 'short' })
		).rejects.toMatchObject({ field: 'password', code: 'password_short' });
	});

	it('respects closed sign-up but lets the CLI create users', async () => {
		updateSettings(db, { allow_sign_up: false });
		await expect(signUp(db, { email: 'a@b.c', name: 'A', password: '12345678' })).rejects.toThrow(
			/closed/
		);
		await expect(
			createUser(db, { email: 'a@b.c', name: 'A', password: '12345678', role: 'admin' })
		).resolves.toMatchObject({
			role: 'admin'
		});
		await expect(createUser(db, { email: 'x@y.z', name: 'X', password: 'short' })).rejects.toThrow(
			/at least/
		);
	});
});

describe('settings', () => {
	it('validates and syncs changes', () => {
		expect(getSettings(db)).toMatchObject({
			site_name: 'Qoddy',
			daily: true,
			default_theme: 'morning'
		});
		setSetting(db, 'daily', 'false');
		expect(getSettings(db).daily).toBe(false);
		expect(() => setSetting(db, 'default_theme', 'nope')).toThrow(Invalid);
		expect(() => setSetting(db, 'pwa', 'true')).toThrow(/Unknown setting/);
	});
});

describe('collections', () => {
	it('adds, edits, moves, browses and deletes', () => {
		const stoics = createCollection(db, { slug: 'stoics', name: 'Stoics' });
		expect(() => createCollection(db, { slug: 'stoics', name: 'Again' })).toThrow(/taken/);
		const a = addThought(db, defaultId(), { text: 'First', author: 'Ann' });
		const b = addThought(db, defaultId(), { text: 'Second 100%' });
		expect(browseThoughts(db, defaultId()).thoughts.map((t) => t.text)).toEqual([
			'Second 100%',
			'First'
		]);
		expect(browseThoughts(db, defaultId(), { search: '%' }).total).toBe(1);
		expect(browseThoughts(db, defaultId(), { search: 'ann' }).total).toBe(1);

		const moved = updateThought(db, a.id, stoics.id, { text: 'First, edited' });
		expect(moved.seq).toBeGreaterThan(b.seq);
		expect(browseThoughts(db, stoics.id).total).toBe(1);

		deleteThought(db, b.id);
		expect(browseThoughts(db, defaultId()).total).toBe(0);
		expect(() => deleteCollection(db, defaultId())).toThrow(/cannot be deleted/);
		deleteCollection(db, stoics.id);
		expect(findCollection(db, 'stoics')).toBeUndefined();
		// The address is free again.
		createCollection(db, { slug: 'stoics', name: 'Stoics again' });
	});

	it('imports CSV all or nothing', () => {
		expect(importCsv(db, defaultId(), 'text,author,notes\n"Hi, there",Me,"**why**"\nBye,,\n')).toBe(
			2
		);
		expect(() => importCsv(db, defaultId(), 'text,color\nok,#123456\nbad,red\n')).toThrow(
			/Line 3, color/
		);
		expect(() => importCsv(db, defaultId(), 'text,owner\nx,y\n')).toThrow(/Unknown column owner/);
		expect(browseThoughts(db, defaultId()).total).toBe(2);
	});
});

describe('sync', () => {
	let user: User;
	beforeEach(async () => {
		user = await createUser(db, { email: 'u@x.y', name: 'U', password: '12345678' });
	});

	const item = (id: string, updatedAt: number, extra: Partial<MineItem> = {}): MineItem => ({
		id,
		data: JSON.stringify({ text: id }),
		key: '',
		updatedAt,
		deleted: false,
		...extra
	});

	it('pulls public changes since a cursor, with tombstones', () => {
		const first = sync(db, null, { since: 0, mineSince: 0 });
		expect(first.settings).toBeDefined();
		expect(first.collections.map((c) => c.slug)).toEqual(['default']);
		expect(first.me).toBeNull();
		expect(first.mine).toBeUndefined();

		const t = addThought(db, defaultId(), { text: 'New' });
		const second = sync(db, null, { since: first.rev, mineSince: 0 });
		expect(second.settings).toBeUndefined();
		expect(second.thoughts.map((x) => x.id)).toEqual([t.id]);

		deleteThought(db, t.id);
		const third = sync(db, null, { since: second.rev, mineSince: 0 });
		expect(third.thoughts).toMatchObject([{ id: t.id, deleted: true, text: '' }]);
		expect(sync(db, null, { since: third.rev + 100, mineSince: 0 }).reset).toBe(true);
	});

	it('pushes personal items; newest edit wins', () => {
		const pushed = sync(db, user, {
			since: 0,
			mineSince: 0,
			mine: { items: [item('aaaaaa1', 10)] }
		});
		expect(pushed.mine?.items.map((i) => i.id)).toEqual(['aaaaaa1']);

		const stale = sync(db, user, {
			since: pushed.rev,
			mineSince: pushed.rev,
			mine: { items: [item('aaaaaa1', 5, { data: '{"text":"old"}' })] }
		});
		expect(stale.mine?.items).toMatchObject([{ id: 'aaaaaa1', updatedAt: 10 }]);

		const deleted = sync(db, user, {
			since: stale.rev,
			mineSince: stale.rev,
			mine: { items: [item('aaaaaa1', 20, { deleted: true })] }
		});
		expect(deleted.mine?.items).toEqual([
			{ id: 'aaaaaa1', data: '', key: '', updatedAt: 20, deleted: true }
		]);
	});

	it('locks atomically and refuses items under a stale key', () => {
		const start = sync(db, user, { since: 0, mineSince: 0, mine: { items: [item('aaaaaa1', 1)] } });
		const lock: Lock = {
			key: 'keykeykey1',
			salt: 'c2FsdA==',
			iterations: 600000,
			check: { iv: 'aXY=', data: 'ZGF0YQ==' }
		};

		// A lock change must re-encrypt every live item.
		const partial = sync(db, user, {
			since: start.rev,
			mineSince: start.rev,
			mine: { lock: { base: start.mine!.lockRev, value: lock }, items: [] }
		});
		expect(partial.mine?.lock).toBeNull();

		const locked = sync(db, user, {
			since: start.rev,
			mineSince: start.rev,
			mine: {
				lock: { base: start.mine!.lockRev, value: lock },
				items: [item('aaaaaa1', 1, { data: 'ciphertext', key: lock.key })]
			}
		});
		expect(locked.mine?.lock?.key).toBe(lock.key);
		expect(locked.mine?.rejected).toEqual([]);

		// Another device still on plaintext, and one racing with an old base.
		const late = sync(db, user, { since: 0, mineSince: 0, mine: { items: [item('bbbbbb2', 5)] } });
		expect(late.mine?.rejected).toEqual([{ id: 'bbbbbb2', reason: 'key' }]);
		const race = sync(db, user, {
			since: 0,
			mineSince: 0,
			mine: { lock: { base: start.mine!.lockRev, value: null }, items: [item('aaaaaa1', 2)] }
		});
		expect(race.mine?.rejected).toEqual([{ id: 'aaaaaa1', reason: 'lock' }]);
		expect(race.mine?.lock?.key).toBe(lock.key);
	});

	it('saves the reader’s language; unknown ones clear it', () => {
		expect(sync(db, user, { since: 0, mineSince: 0, locale: 'ru' }).me?.locale).toBe('ru');
		expect(sync(db, user, { since: 0, mineSince: 0 }).me?.locale).toBe('ru');
		expect(sync(db, user, { since: 0, mineSince: 0, locale: 'xx' }).me?.locale).toBeNull();
		expect(parseSyncRequest({ locale: 5 })).toEqual({ since: 0, mineSince: 0 });
	});

	it('rejects malformed requests', () => {
		expect(() => parseSyncRequest({ since: 0, mine: { items: [{ id: '../x' }] } })).toThrow(
			Invalid
		);
		expect(() =>
			parseSyncRequest({ mine: { items: [], lock: { base: 0, value: { key: 'k' } } } })
		).toThrow(/lock/);
		expect(parseSyncRequest({ since: -5, mineSince: 'x' })).toEqual({ since: 0, mineSince: 0 });
	});
});
