// Sync: one request that pushes a device's personal changes and pulls
// everything changed since its last sync.
//
// Public data (settings, collections, thoughts) is the same for everyone.
// Personal thoughts are opaque to the server: `data` is either the thought's
// JSON or, when the collection is locked, an AES-GCM envelope the browser made
// from the reader's password. The server never sees the password or the key;
// it only checks that each item is written with the current key id, so a
// device with a stale key cannot mix keys within one collection.
//
// Conflicts on an item: the newest `updatedAt` (device clock) wins. A push the
// server refuses as older comes back in the response with the server's copy.

import { currentRev, Invalid, nextRev, transaction, type Db } from './db.ts';
import { getSettings } from './settings.ts';
import { findUser, setLocale, setTheme, type User } from './accounts.ts';
import { isId } from '../thought.ts';
import type { Lock, MineItem, SyncRequest, SyncResponse } from '../wire.ts';

export type { Lock, MineItem, SyncRequest, SyncResponse };

export const MAX_ITEMS = 5000;
export const MAX_ITEM_BYTES = 256 * 1024;
const MAX_PUSH = 5000;

const b64 = (value: unknown, max: number) =>
	typeof value === 'string' && value.length <= max && /^[A-Za-z0-9+/]*={0,2}$/.test(value);

function checkLock(value: unknown): Lock | null {
	if (value === null) return null;
	const lock = value as Lock;
	if (
		typeof lock !== 'object' ||
		typeof lock.key !== 'string' ||
		!isId(lock.key) ||
		!b64(lock.salt, 64) ||
		!Number.isInteger(lock.iterations) ||
		lock.iterations < 100_000 ||
		lock.iterations > 10_000_000 ||
		typeof lock.check !== 'object' ||
		!b64(lock.check?.iv, 32) ||
		!b64(lock.check?.data, 256)
	) {
		throw new Invalid('Malformed lock.');
	}
	return {
		key: lock.key,
		salt: lock.salt,
		iterations: lock.iterations,
		check: { iv: lock.check.iv, data: lock.check.data }
	};
}

function checkItem(value: unknown): MineItem {
	const item = value as MineItem;
	if (
		typeof item !== 'object' ||
		item === null ||
		typeof item.id !== 'string' ||
		!isId(item.id) ||
		typeof item.data !== 'string' ||
		Buffer.byteLength(item.data) > MAX_ITEM_BYTES ||
		typeof item.key !== 'string' ||
		(item.key !== '' && !isId(item.key)) ||
		!Number.isSafeInteger(item.updatedAt) ||
		typeof item.deleted !== 'boolean'
	) {
		throw new Invalid('Malformed item.');
	}
	const { id, data, key, updatedAt, deleted } = item;
	return { id, data, key, updatedAt, deleted };
}

/** Validates an untrusted request body. */
export function parseSyncRequest(body: unknown): SyncRequest {
	const input = body as Record<string, unknown>;
	if (typeof input !== 'object' || input === null) throw new Invalid('Malformed request.');
	const cursor = (value: unknown) =>
		Number.isSafeInteger(value) && (value as number) >= 0 ? (value as number) : 0;
	const request: SyncRequest = { since: cursor(input.since), mineSince: cursor(input.mineSince) };
	if (input.theme === null || typeof input.theme === 'string') request.theme = input.theme;
	if (input.locale === null || typeof input.locale === 'string') request.locale = input.locale;
	const mine = input.mine as Record<string, unknown> | undefined;
	if (mine !== undefined) {
		if (typeof mine !== 'object' || mine === null || !Array.isArray(mine.items)) {
			throw new Invalid('Malformed request.');
		}
		if (mine.items.length > MAX_PUSH) throw new Invalid('Too many items in one sync.');
		request.mine = { items: mine.items.map(checkItem) };
		const lock = mine.lock as { base: unknown; value: unknown } | undefined;
		if (lock !== undefined) {
			if (typeof lock !== 'object' || lock === null || !Number.isSafeInteger(lock.base)) {
				throw new Invalid('Malformed lock.');
			}
			request.mine.lock = { base: lock.base as number, value: checkLock(lock.value) };
		}
	}
	return request;
}

interface ItemRow {
	id: string;
	data: string;
	key: string;
	updated_at: number;
	deleted: number;
}

const toItem = (row: ItemRow): MineItem => ({
	id: row.id,
	data: row.data,
	key: row.key,
	updatedAt: row.updated_at,
	deleted: row.deleted === 1
});

function personal(db: Db, userId: number): { lock: Lock | null; rev: number } {
	let row = db.prepare('SELECT lock, rev FROM personal WHERE user_id = ?').get(userId) as
		{ lock: string | null; rev: number } | undefined;
	if (!row) {
		row = { lock: null, rev: 0 };
		db.prepare('INSERT INTO personal (user_id, lock, rev) VALUES (?, NULL, 0)').run(userId);
	}
	return { lock: row.lock ? (JSON.parse(row.lock) as Lock) : null, rev: row.rev };
}

class LockConflict extends Error {}

/** Applies a push; returns rejected items and server copies that beat stale pushes. */
function push(db: Db, userId: number, mine: NonNullable<SyncRequest['mine']>) {
	const rejected: NonNullable<SyncResponse['mine']>['rejected'] = [];
	const newer: MineItem[] = [];
	const state = personal(db, userId);
	if (mine.lock) {
		if (mine.lock.base !== state.rev) {
			return {
				rejected: mine.items.map((item) => ({ id: item.id, reason: 'lock' as const })),
				newer
			};
		}
		state.lock = mine.lock.value;
		db.prepare('UPDATE personal SET lock = ?, rev = ? WHERE user_id = ?').run(
			state.lock ? JSON.stringify(state.lock) : null,
			nextRev(db),
			userId
		);
	}
	const key = state.lock?.key ?? '';
	const find = db.prepare(
		'SELECT id, data, key, updated_at, deleted FROM personal_item WHERE user_id = ? AND id = ?'
	);
	const count = db.prepare(
		'SELECT count(*) AS n FROM personal_item WHERE user_id = ? AND deleted = 0'
	);
	const upsert = db.prepare(
		`INSERT INTO personal_item (user_id, id, data, key, updated_at, deleted, rev) VALUES (?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT (user_id, id) DO UPDATE SET data = excluded.data, key = excluded.key,
			updated_at = excluded.updated_at, deleted = excluded.deleted, rev = excluded.rev`
	);
	for (const item of mine.items) {
		if (!item.deleted && item.key !== key) {
			rejected.push({ id: item.id, reason: 'key' });
			continue;
		}
		const existing = find.get(userId, item.id) as ItemRow | undefined;
		if (existing && existing.updated_at > item.updatedAt) {
			newer.push(toItem(existing));
			continue;
		}
		if (!existing && !item.deleted && (count.get(userId) as { n: number }).n >= MAX_ITEMS) {
			rejected.push({ id: item.id, reason: 'limit' });
			continue;
		}
		// A tombstone keeps nothing of the thought.
		const data = item.deleted ? '' : item.data;
		upsert.run(
			userId,
			item.id,
			data,
			item.deleted ? '' : item.key,
			item.updatedAt,
			+item.deleted,
			nextRev(db)
		);
	}
	// A lock change re-encrypts the whole collection at once: if any live item
	// still has another key (another device wrote it meanwhile), undo it all.
	if (mine.lock) {
		const stale = db
			.prepare('SELECT 1 FROM personal_item WHERE user_id = ? AND deleted = 0 AND key != ? LIMIT 1')
			.get(userId, key);
		if (stale) throw new LockConflict();
	}
	return { rejected, newer };
}

/** Pushes the device's changes (signed in only), then pulls what it lacks. */
export function sync(db: Db, user: User | null, request: SyncRequest): SyncResponse {
	return transaction(db, () => {
		let pushed: ReturnType<typeof push> = { rejected: [], newer: [] };
		if (user) {
			if (request.theme !== undefined) setTheme(db, user, request.theme);
			if (request.locale !== undefined) setLocale(db, user, request.locale);
			if (request.mine) {
				// A refused lock change undoes the push but still answers with a pull.
				db.exec('SAVEPOINT push');
				try {
					pushed = push(db, user.id, request.mine);
					db.exec('RELEASE push');
				} catch (error) {
					db.exec('ROLLBACK TO push');
					db.exec('RELEASE push');
					if (!(error instanceof LockConflict)) throw error;
					pushed = {
						rejected: request.mine.items.map((item) => ({ id: item.id, reason: 'lock' })),
						newer: []
					};
				}
			}
		}
		return pull(db, user, request, pushed);
	});
}

function pull(
	db: Db,
	user: User | null,
	request: SyncRequest,
	pushed: ReturnType<typeof push>
): SyncResponse {
	const rev = currentRev(db);
	const reset = request.since > rev || request.mineSince > rev;
	const since = reset ? 0 : request.since;
	const response: SyncResponse = { rev, collections: [], thoughts: [], me: null };
	if (reset) response.reset = true;

	const settings = getSettings(db);
	if (settings.rev > since) {
		const { rev: _, ...rest } = settings;
		response.settings = rest;
	}
	response.collections = (
		db
			.prepare(
				'SELECT id, slug, name, description, deleted FROM collection WHERE rev > ? ORDER BY id'
			)
			.all(since) as unknown as SyncResponse['collections']
	).map((row) => ({ ...row, deleted: Boolean(row.deleted) }));
	response.thoughts = (
		db
			.prepare(
				`SELECT id, seq, collection_id, text, author, source, notes, lang, theme, color, font, deleted
				FROM thought WHERE rev > ? ORDER BY seq`
			)
			.all(since) as unknown as SyncResponse['thoughts']
	).map((row) => ({ ...row, deleted: Boolean(row.deleted) }));

	if (user) {
		response.me = findUser(db, user.id) ?? null;
		const state = personal(db, user.id);
		const mineSince = reset ? 0 : request.mineSince;
		const items = (
			db
				.prepare(
					'SELECT id, data, key, updated_at, deleted FROM personal_item WHERE user_id = ? AND rev > ? ORDER BY rev'
				)
				.all(user.id, mineSince) as unknown as ItemRow[]
		).map(toItem);
		const listed = new Set(items.map((item) => item.id));
		response.mine = {
			lock: state.lock,
			lockRev: state.rev,
			items: [...items, ...pushed.newer.filter((item) => !listed.has(item.id))],
			rejected: pushed.rejected
		};
	}
	return response;
}
