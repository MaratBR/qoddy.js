import { beforeEach, describe, expect, it } from 'vitest';
import { backup, currentRev, databaseId, open, Invalid, type Db } from './db.ts';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
	authenticate,
	createSession,
	createUser,
	deleteAccount,
	deleteSession,
	findUser,
	noteSignIn,
	signInThrottled,
	listAccounts,
	sessionUser,
	setPassword,
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
	listCollections,
	setCollectionHidden,
	updateCollection,
	updateThought
} from './collections.ts';
import { MAX_BYTES, parseSyncRequest, sync, type Lock, type MineItem } from './sync.ts';

let db: Db;
beforeEach(() => {
	db = open(':memory:');
});

const defaultId = () => findCollection(db, 'default')!.id;

describe('backup', () => {
	it('copies the database into a file SQLite opens', () => {
		createCollection(db, { slug: 'kept', name: 'Kept' });
		const dir = mkdtempSync(join(tmpdir(), 'qoddy-test-'));
		try {
			const path = join(dir, 'copy.db');
			writeFileSync(path, backup(db));
			const copy = new DatabaseSync(path, { readOnly: true });
			expect(copy.prepare('SELECT name FROM collection WHERE slug = ?').get('kept')).toEqual({
				name: 'Kept'
			});
			expect(databaseId(copy)).toBe(databaseId(db));
			copy.close();
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});

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

	it('lists accounts with their role, creation date and live thoughts', async () => {
		const admin = await createUser(db, {
			email: 'a@x.y',
			name: 'A',
			password: '12345678',
			role: 'admin'
		});
		const reader = await createUser(db, { email: 'r@x.y', name: 'R', password: '12345678' });
		const insert = db.prepare(
			'INSERT INTO personal_item (user_id, id, data, updated_at, deleted, rev) VALUES (?, ?, ?, 0, ?, 1)'
		);
		insert.run(reader.id, 'one', '{}', 0);
		insert.run(reader.id, 'two', '{}', 0);
		insert.run(reader.id, 'gone', '{}', 1);
		insert.run(admin.id, 'gone', '{}', 1);

		const accounts = listAccounts(db);
		expect(accounts).toMatchObject([
			{ id: admin.id, email: 'a@x.y', role: 'admin', thoughts: 0 },
			{ id: reader.id, email: 'r@x.y', role: 'user', thoughts: 2 }
		]);
		for (const account of accounts) {
			expect(account.created_at).toMatch(/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/);
			expect(account).not.toHaveProperty('password_hash');
		}
	});
});

describe('settings', () => {
	it('validates and syncs changes', () => {
		expect(getSettings(db)).toMatchObject({
			site_name: 'Qoddy',
			home: defaultId(),
			default_theme: 'morning'
		});
		setSetting(db, 'allow_sign_up', 'false');
		expect(getSettings(db).allow_sign_up).toBe(false);
		expect(() => setSetting(db, 'default_theme', 'nope')).toThrow(Invalid);
		expect(() => setSetting(db, 'daily', 'true')).toThrow(/Unknown setting/);
		expect(getSettings(db).hide_from_search).toBe(false);
		setSetting(db, 'hide_from_search', 'true');
		expect(getSettings(db).hide_from_search).toBe(true);
		expect(
			sync(db, null, parseSyncRequest({ since: 0, mineSince: 0 })).settings
		).not.toHaveProperty('hide_from_search');
	});

	it('puts any public collection, or the reader’s own thoughts, on the home page', () => {
		const stoics = createCollection(db, { slug: 'stoics', name: 'Stoics' });
		const before = getSettings(db).rev;
		setSetting(db, 'home', 'stoics');
		expect(getSettings(db)).toMatchObject({ home: stoics.id });
		expect(getSettings(db).rev).toBeGreaterThan(before);
		setSetting(db, 'home', 'mine');
		expect(getSettings(db).home).toBeNull();
		expect(() => setSetting(db, 'home', 'nope')).toThrow(/No collection/);
		expect(() => updateSettings(db, { home: 9999 })).toThrow(/no longer exists/);
		expect(getSettings(db).home).toBeNull();
	});

	it('keeps the home collection until another takes its place', () => {
		const stoics = createCollection(db, { slug: 'stoics', name: 'Stoics' });
		updateSettings(db, { home: stoics.id });
		// Home is kept by id, so its address can change.
		updateCollection(db, stoics.id, { slug: 'stoa', name: 'Stoics' });
		expect(getSettings(db).home).toBe(stoics.id);
		expect(() => deleteCollection(db, stoics.id)).toThrow(/home page/);
		deleteCollection(db, defaultId());
		expect(findCollection(db, 'default')).toBeUndefined();
		setSetting(db, 'home', 'mine');
		deleteCollection(db, stoics.id);
		expect(findCollection(db, 'stoa')).toBeUndefined();
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
		expect(() => deleteCollection(db, defaultId())).toThrow(/home page/);
		deleteCollection(db, stoics.id);
		expect(findCollection(db, 'stoics')).toBeUndefined();
		// The address is free again.
		createCollection(db, { slug: 'stoics', name: 'Stoics again' });
	});

	it('hides any collection but the home page’s, which a hidden one cannot become', () => {
		const stoics = createCollection(db, { slug: 'stoics', name: 'Stoics' });
		expect(stoics.hidden).toBe(false);
		expect(() => setCollectionHidden(db, defaultId(), true)).toThrow(/home page/);
		setCollectionHidden(db, stoics.id, true);
		expect(findCollection(db, 'stoics')?.hidden).toBe(true);
		expect(listCollections(db).find((c) => c.id === stoics.id)?.hidden).toBe(true);
		expect(() => updateSettings(db, { home: stoics.id })).toThrow(Invalid);
		expect(getSettings(db).home).toBe(defaultId());
		setCollectionHidden(db, stoics.id, false);
		expect(updateSettings(db, { home: stoics.id }).home).toBe(stoics.id);
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
	const dbId = () => databaseId(db);

	it('pulls public changes since a cursor, with tombstones', () => {
		const first = sync(db, null, { db: dbId(), since: 0, mineSince: 0 });
		expect(first.settings).toBeDefined();
		expect(first.collections.map((c) => c.slug)).toEqual(['default']);
		expect(first.me).toBeNull();
		expect(first.mine).toBeUndefined();

		const t = addThought(db, defaultId(), { text: 'New' });
		const second = sync(db, null, { db: dbId(), since: first.rev, mineSince: 0 });
		expect(second.settings).toBeUndefined();
		expect(second.thoughts.map((x) => x.id)).toEqual([t.id]);

		deleteThought(db, t.id);
		const third = sync(db, null, { db: dbId(), since: second.rev, mineSince: 0 });
		expect(third.thoughts).toMatchObject([{ id: t.id, deleted: true, text: '' }]);
		expect(sync(db, null, { db: dbId(), since: third.rev + 100, mineSince: 0 }).reset).toBe(true);
	});

	it('sends a hidden collection and its thoughts as deletions, and back when shown', () => {
		const stoics = createCollection(db, { slug: 'stoics', name: 'Stoics' });
		const kept = addThought(db, stoics.id, { text: 'Kept', author: 'Seneca' });
		const gone = addThought(db, stoics.id, { text: 'Gone' });
		deleteThought(db, gone.id);
		const before = sync(db, null, { db: dbId(), since: 0, mineSince: 0 });
		expect(before.thoughts.find((x) => x.id === kept.id)).toMatchObject({ deleted: false });

		setCollectionHidden(db, stoics.id, true);
		const hidden = { id: stoics.id, slug: `~${stoics.id}`, name: '', deleted: true };
		const tombstone = { text: '', author: null, deleted: true };
		const isLive = (response: ReturnType<typeof sync>) =>
			response.collections.some((c) => c.id === stoics.id && !c.deleted) ||
			response.thoughts.some((x) => x.collection_id === stoics.id && !x.deleted);
		// A device that had them, and a fresh one.
		for (const since of [before.rev, 0]) {
			const pulled = sync(db, null, { db: dbId(), since, mineSince: 0 });
			expect(isLive(pulled)).toBe(false);
			expect(pulled.collections.find((c) => c.id === stoics.id)).toMatchObject(hidden);
			expect(pulled.thoughts.find((x) => x.id === kept.id)).toMatchObject(tombstone);
			expect(pulled.thoughts.find((x) => x.id === gone.id)).toMatchObject(tombstone);
		}
		// Thoughts added while hidden stay hidden.
		const added = addThought(db, stoics.id, { text: 'Added' });
		const later = sync(db, null, { db: dbId(), since: before.rev, mineSince: 0 });
		expect(later.thoughts.find((x) => x.id === added.id)).toMatchObject(tombstone);

		setCollectionHidden(db, stoics.id, false);
		const shown = sync(db, null, { db: dbId(), since: later.rev, mineSince: 0 });
		expect(shown.collections).toMatchObject([{ id: stoics.id, slug: 'stoics', deleted: false }]);
		expect(shown.thoughts.filter((x) => !x.deleted).map((x) => x.text)).toEqual(['Kept', 'Added']);
		expect(shown.thoughts.find((x) => x.id === gone.id)).toMatchObject({ deleted: true });
	});

	it('starts over on cursors from another database, even at the same revision', () => {
		const other = open(':memory:');
		const theirs = sync(other, null, { db: '', since: 0, mineSince: 0 });
		expect(theirs.db).not.toBe(dbId());
		addThought(db, defaultId(), { text: 'Only here' });
		const pulled = sync(db, null, { db: theirs.db, since: currentRev(db), mineSince: 0 });
		expect(pulled.reset).toBe(true);
		expect(pulled.db).toBe(dbId());
		expect(pulled.thoughts.map((x) => x.text)).toEqual(['Only here']);
		// A first sync has nothing to start over.
		expect(sync(db, null, { db: '', since: 0, mineSince: 0 }).reset).toBeUndefined();
	});

	it('pushes personal items; newest edit wins', () => {
		const pushed = sync(db, user, {
			db: dbId(),
			since: 0,
			mineSince: 0,
			mine: { items: [item('aaaaaa1', 10)] }
		});
		expect(pushed.mine?.items.map((i) => i.id)).toEqual(['aaaaaa1']);

		const stale = sync(db, user, {
			db: dbId(),
			since: pushed.rev,
			mineSince: pushed.rev,
			mine: { items: [item('aaaaaa1', 5, { data: '{"text":"old"}' })] }
		});
		expect(stale.mine?.items).toMatchObject([{ id: 'aaaaaa1', updatedAt: 10 }]);

		const deleted = sync(db, user, {
			db: dbId(),
			since: stale.rev,
			mineSince: stale.rev,
			mine: { items: [item('aaaaaa1', 20, { deleted: true })] }
		});
		expect(deleted.mine?.items).toEqual([
			{ id: 'aaaaaa1', data: '', key: '', updatedAt: 20, deleted: true }
		]);
	});

	it('locks atomically and refuses items under a stale key', () => {
		const start = sync(db, user, {
			db: dbId(),
			since: 0,
			mineSince: 0,
			mine: { items: [item('aaaaaa1', 1)] }
		});
		const lock: Lock = {
			key: 'keykeykey1',
			salt: 'c2FsdA==',
			iterations: 600000,
			check: { iv: 'aXY=', data: 'ZGF0YQ==' }
		};

		// A lock change must re-encrypt every live item.
		const partial = sync(db, user, {
			db: dbId(),
			since: start.rev,
			mineSince: start.rev,
			mine: { lock: { base: start.mine!.lockRev, value: lock }, items: [] }
		});
		expect(partial.mine?.lock).toBeNull();

		const locked = sync(db, user, {
			db: dbId(),
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
		const late = sync(db, user, {
			db: dbId(),
			since: 0,
			mineSince: 0,
			mine: { items: [item('bbbbbb2', 5)] }
		});
		expect(late.mine?.rejected).toEqual([{ id: 'bbbbbb2', reason: 'key' }]);
		const race = sync(db, user, {
			db: dbId(),
			since: 0,
			mineSince: 0,
			mine: { lock: { base: start.mine!.lockRev, value: null }, items: [item('aaaaaa1', 2)] }
		});
		expect(race.mine?.rejected).toEqual([{ id: 'aaaaaa1', reason: 'lock' }]);
		expect(race.mine?.lock?.key).toBe(lock.key);
	});

	it('saves the reader’s language; unknown ones clear it', () => {
		expect(sync(db, user, { db: dbId(), since: 0, mineSince: 0, locale: 'ru' }).me?.locale).toBe(
			'ru'
		);
		expect(sync(db, user, { db: dbId(), since: 0, mineSince: 0 }).me?.locale).toBe('ru');
		expect(
			sync(db, user, { db: dbId(), since: 0, mineSince: 0, locale: 'xx' }).me?.locale
		).toBeNull();
		expect(parseSyncRequest({ locale: 5 })).toEqual({ db: '', since: 0, mineSince: 0 });
	});

	it('rejects malformed requests', () => {
		expect(() => parseSyncRequest({ since: 0, mine: { items: [{ id: '../x' }] } })).toThrow(
			Invalid
		);
		expect(() =>
			parseSyncRequest({ mine: { items: [], lock: { base: 0, value: { key: 'k' } } } })
		).toThrow(/lock/);
		expect(parseSyncRequest({ since: -5, mineSince: 'x' })).toEqual({
			db: '',
			since: 0,
			mineSince: 0
		});
	});
});

describe('password reset', () => {
	it('says whether the thoughts stay encrypted with the old password', async () => {
		const user = await createUser(db, { email: 'p@x.y', name: 'P', password: '12345678' });
		expect(await setPassword(db, user.email, 'another one')).toBe(false);
		const lock: Lock = {
			key: 'keykeykey1',
			salt: 'c2FsdA==',
			iterations: 600_000,
			check: { iv: 'aXY=', data: 'ZGF0YQ==' }
		};
		sync(db, user, {
			db: databaseId(db),
			since: 0,
			mineSince: 0,
			mine: { lock: { base: 0, value: lock }, items: [] }
		});
		expect(await setPassword(db, user.email, 'a third one')).toBe(true);
		expect(await authenticate(db, user.email, 'a third one')).not.toBeNull();
	});
});

describe('account deletion and sign-in limits', () => {
	it('deletes an account with everything in it, but never the last admin', async () => {
		const admin = await createUser(db, {
			email: 'admin@x.y',
			name: 'A',
			password: '12345678',
			role: 'admin'
		});
		const reader = await createUser(db, { email: 'r@x.y', name: 'R', password: '12345678' });
		createSession(db, reader.id);
		sync(
			db,
			reader,
			parseSyncRequest({
				since: 0,
				mineSince: 0,
				mine: { items: [{ id: 'item1234', data: '{}', key: '', updatedAt: 1, deleted: false }] }
			})
		);
		deleteAccount(db, reader.id);
		expect(findUser(db, reader.id)).toBeUndefined();
		for (const table of ['session', 'personal', 'personal_item']) {
			expect(
				db.prepare(`SELECT count(*) AS n FROM ${table} WHERE user_id = ?`).get(reader.id)
			).toEqual({
				n: 0
			});
		}
		expect(() => deleteAccount(db, admin.id)).toThrow(
			expect.objectContaining({ code: 'last_admin' })
		);
		await createUser(db, { email: 'b@x.y', name: 'B', password: '12345678', role: 'admin' });
		deleteAccount(db, admin.id);
		expect(findUser(db, admin.id)).toBeUndefined();
	});

	it('refuses an email after ten wrong passwords for a while', () => {
		const start = 1_000_000;
		for (let i = 0; i < 10; i++) {
			expect(signInThrottled('Limit@x.y', start)).toBe(false);
			noteSignIn('limit@x.y', false, start);
		}
		expect(signInThrottled('limit@x.y', start + 1000)).toBe(true);
		expect(signInThrottled('other@x.y', start + 1000)).toBe(false);
		expect(signInThrottled('limit@x.y', start + 16 * 60_000)).toBe(false);
		noteSignIn('limit@x.y', true, start);
		expect(signInThrottled('limit@x.y', start)).toBe(false);
	});

	it('keeps a push out of another account and caps a reader’s bytes', async () => {
		const reader = await createUser(db, { email: 'q@x.y', name: 'Q', password: '12345678' });
		const item = (id: string, data: string) => ({
			id,
			data,
			key: '',
			updatedAt: 1,
			deleted: false
		});
		sync(
			db,
			reader,
			parseSyncRequest({
				since: 0,
				mineSince: 0,
				owner: reader.id + 1,
				mine: { items: [item('item1234', '{}')] }
			})
		);
		expect(sync(db, reader, parseSyncRequest({ since: 0, mineSince: 0 })).mine!.items).toEqual([]);

		const big = 'x'.repeat(250 * 1024);
		const items = Array.from({ length: Math.ceil(MAX_BYTES / big.length) + 1 }, (_, i) =>
			item(`item${String(i).padStart(4, '0')}`, big)
		);
		const response = sync(db, reader, { since: 0, mineSince: 0, db: '', mine: { items } });
		expect(response.mine!.rejected.some((r) => r.reason === 'limit')).toBe(true);
		const stored = db
			.prepare('SELECT total(length(data)) AS n FROM personal_item WHERE user_id = ?')
			.get(reader.id) as { n: number };
		expect(stored.n).toBeLessThanOrEqual(MAX_BYTES);
	});

	it('tells which build the server runs', () => {
		expect(sync(db, null, parseSyncRequest({ since: 0, mineSince: 0 })).server).toMatchObject({
			started: expect.any(Number)
		});
	});
});
