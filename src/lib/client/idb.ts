// A thin promise layer over IndexedDB. Where IndexedDB is missing or blocked
// (some private modes), every call quietly does nothing: the library keeps
// working in memory for the session.
//
// Stores: `thoughts` (public, by id), `collections` (by id), `mine` (personal
// records, by id), `keys` (thought-lock keys by key id) and `meta` (single values).
//
// With the app lock on (`useCipher`), every value is stored encrypted as
// `{ id?, sealed }`, bound to its store and key so values cannot be swapped,
// and decrypted as it is read. Values written before the lock are read as
// they are. A change marked `plain` (the lock's own settings) is never
// encrypted: it is needed to open everything else.

import { decryptText, encryptText } from './crypto.ts';

const NAME = 'qoddy';
const VERSION = 1;

export type StoreName = 'thoughts' | 'collections' | 'mine' | 'keys' | 'meta';

export const STORES: readonly StoreName[] = ['thoughts', 'collections', 'mine', 'keys', 'meta'];

/** Stores whose values carry their own key (`id`). */
const INLINE = new Set<StoreName>(['thoughts', 'collections', 'mine']);

interface Sealed {
	id?: IDBValidKey;
	sealed: string;
}

function request<T>(req: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

let opened: Promise<IDBDatabase | null> | undefined;
let cipher: CryptoKey | null = null;

/** Encrypts what is written from now on, and decrypts what is read; null stores plainly. */
export function useCipher(key: CryptoKey | null): void {
	cipher = key;
}

function database(): Promise<IDBDatabase | null> {
	return (opened ??= new Promise((resolve) => {
		try {
			const open = indexedDB.open(NAME, VERSION);
			open.onupgradeneeded = () => {
				const db = open.result;
				db.createObjectStore('thoughts', { keyPath: 'id' });
				db.createObjectStore('collections', { keyPath: 'id' });
				db.createObjectStore('mine', { keyPath: 'id' });
				db.createObjectStore('keys');
				db.createObjectStore('meta');
			};
			open.onsuccess = () => {
				// Another tab erasing this device's data must not wait on us.
				open.result.onversionchange = () => open.result.close();
				resolve(open.result);
			};
			open.onerror = () => resolve(null);
			open.onblocked = () => resolve(null);
		} catch {
			resolve(null);
		}
	}));
}

/** Whether this device stores anything (false in some private modes: memory only). */
export async function available(): Promise<boolean> {
	return (await database()) !== null;
}

const context = (store: StoreName, key: IDBValidKey) => `${store}:${String(key)}`;

function isSealed(value: unknown): value is Sealed {
	return (
		typeof value === 'object' &&
		value !== null &&
		typeof (value as Sealed).sealed === 'string' &&
		Object.keys(value).every((key) => key === 'sealed' || key === 'id')
	);
}

/** Thrown for a value encrypted with a key this session does not hold. */
export class SealedError extends Error {}

async function open<T>(store: StoreName, key: IDBValidKey, value: unknown): Promise<T> {
	if (!isSealed(value)) return value as T;
	if (!cipher) throw new SealedError('Locked');
	const json = await decryptText(cipher, context(store, key), value.sealed);
	if (json === null) throw new SealedError('Undecryptable');
	return JSON.parse(json) as T;
}

async function seal(store: StoreName, key: IDBValidKey, value: unknown): Promise<unknown> {
	if (!cipher) return value;
	if (value instanceof CryptoKey) throw new Error('A CryptoKey cannot be stored encrypted.');
	const sealed = await encryptText(cipher, context(store, key), JSON.stringify(value));
	return INLINE.has(store) ? { id: key, sealed } : { sealed };
}

/**
 * All entries of a store, decrypted. An entry this session cannot decrypt is
 * left out (and left alone in the database), never dropped.
 */
export async function entries<T>(store: StoreName): Promise<[IDBValidKey, T][]> {
	const db = await database();
	if (!db) return [];
	const os = db.transaction(store).objectStore(store);
	const [keys, values] = await Promise.all([request(os.getAllKeys()), request(os.getAll())]);
	const out: [IDBValidKey, T][] = [];
	for (let index = 0; index < keys.length; index++) {
		try {
			out.push([keys[index], await open<T>(store, keys[index], values[index])]);
		} catch (error) {
			console.warn(`Qoddy: could not read ${store} ${String(keys[index])}`, error);
		}
	}
	return out;
}

export async function getAll<T>(store: StoreName): Promise<T[]> {
	return (await entries<T>(store)).map(([, value]) => value);
}

/** One value as stored, never decrypted (for `plain` values). */
export async function getPlain<T>(store: StoreName, key: IDBValidKey): Promise<T | undefined> {
	const db = await database();
	if (!db) return undefined;
	return request(db.transaction(store).objectStore(store).get(key)) as Promise<T | undefined>;
}

export interface Change {
	store: StoreName;
	/** Delete `key`, or put `value` (at `key` for out-of-line stores). */
	put?: unknown;
	key?: IDBValidKey;
	clear?: boolean;
	/** Store `put` as it is, even under the app lock. */
	plain?: boolean;
}

/** Applies changes in one transaction, resolving once it commits. */
export async function write(changes: Change[]): Promise<void> {
	const db = await database();
	if (!db || changes.length === 0) return;
	// Encrypt first: a transaction closes if it waits on anything but itself.
	const values = await Promise.all(
		changes.map((change) => {
			if (change.put === undefined || change.plain) return change.put;
			const key = INLINE.has(change.store) ? (change.put as { id: IDBValidKey }).id : change.key!;
			return seal(change.store, key, change.put);
		})
	);
	const stores = [...new Set(changes.map((change) => change.store))];
	const tx = db.transaction(stores, 'readwrite');
	changes.forEach((change, index) => {
		const os = tx.objectStore(change.store);
		if (change.clear) os.clear();
		else if (change.put !== undefined)
			os.put(values[index], INLINE.has(change.store) ? undefined : change.key);
		else if (change.key !== undefined) os.delete(change.key);
	});
	await new Promise<void>((resolve, reject) => {
		tx.oncomplete = () => resolve();
		tx.onerror = tx.onabort = () => reject(tx.error);
	});
}

/** Deletes every value stored on this device (a forgotten app passcode). */
export async function erase(): Promise<void> {
	const db = await database();
	db?.close();
	opened = undefined;
	await new Promise<void>((resolve) => {
		try {
			const deleting = indexedDB.deleteDatabase(NAME);
			deleting.onsuccess = deleting.onerror = deleting.onblocked = () => resolve();
		} catch {
			resolve();
		}
	});
}
