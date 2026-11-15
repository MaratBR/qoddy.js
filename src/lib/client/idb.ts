// A thin promise layer over IndexedDB. Where IndexedDB is missing or blocked
// (some private modes), every call quietly does nothing: the library keeps
// working in memory for the session.
//
// Stores: `thoughts` (public, by id), `collections` (by id), `mine` (personal
// records, by id), `keys` (CryptoKeys by key id) and `meta` (single values).

const NAME = 'qoddy';
const VERSION = 1;

export type StoreName = 'thoughts' | 'collections' | 'mine' | 'keys' | 'meta';

function request<T>(req: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

let opened: Promise<IDBDatabase | null> | undefined;

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
			open.onsuccess = () => resolve(open.result);
			open.onerror = () => resolve(null);
			open.onblocked = () => resolve(null);
		} catch {
			resolve(null);
		}
	}));
}

export async function getAll<T>(store: StoreName): Promise<T[]> {
	const db = await database();
	if (!db) return [];
	return request(db.transaction(store).objectStore(store).getAll()) as Promise<T[]>;
}

/** All entries of an out-of-line-keyed store. */
export async function entries<T>(store: StoreName): Promise<[IDBValidKey, T][]> {
	const db = await database();
	if (!db) return [];
	const os = db.transaction(store).objectStore(store);
	const [keys, values] = await Promise.all([request(os.getAllKeys()), request(os.getAll())]);
	return keys.map((key, index) => [key, values[index] as T]);
}

export interface Change {
	store: StoreName;
	/** Delete `key`, or put `value` (at `key` for out-of-line stores). */
	put?: unknown;
	key?: IDBValidKey;
	clear?: boolean;
}

/** Applies changes in one transaction, resolving once it commits. */
export async function write(changes: Change[]): Promise<void> {
	const db = await database();
	if (!db || changes.length === 0) return;
	const stores = [...new Set(changes.map((change) => change.store))];
	const tx = db.transaction(stores, 'readwrite');
	for (const change of changes) {
		const os = tx.objectStore(change.store);
		if (change.clear) os.clear();
		else if (change.put !== undefined) os.put(change.put, change.key);
		else if (change.key !== undefined) os.delete(change.key);
	}
	await new Promise<void>((resolve, reject) => {
		tx.oncomplete = () => resolve();
		tx.onerror = tx.onabort = () => reject(tx.error);
	});
}
