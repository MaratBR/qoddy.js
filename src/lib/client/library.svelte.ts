// The library: everything the app reads and writes, kept on this device.
//
// Pages never talk to the server. They read reactive state here and call its
// methods; the library persists to IndexedDB and syncs with `/api/sync` when
// it can. It works the same with or without an account:
//
// - Public collections and thoughts are pulled and kept for offline reading.
// - Your own thoughts are written locally first. Without an account they stay
//   on this device. Signing in adopts them into the account's collection
//   (encrypting them first if that collection is locked) and keeps every
//   device in step from then on.
//
// Personal records are stored here exactly as the server stores them (plain
// JSON, or encrypted with the collection's key), with a `dirty` flag until the
// server has them. `mine` is the readable view, rebuilt after every change.
//
// Your thoughts leave this device only when you ask: deleting one, signing
// out, deleting the account, or erasing the device. Sync never drops one as a
// side effect: changes another account's sign-in would discard need the
// reader's word first (`UnsyncedError`), and a server restored from a backup
// gets this device's thoughts again rather than losing them.
//
// The app lock (this device only) encrypts everything stored here with a key
// opened by a passcode or password; until it is opened, nothing is loaded.

import * as idb from './idb.ts';
import { store, stored } from './storage.ts';
import { i18n, t } from './i18n.svelte.ts';
import { findLocale } from '../locales.ts';
import {
	createAppLock,
	createLock,
	decryptItem,
	encryptItem,
	exportKey,
	importKey,
	openAppLock,
	openLock,
	type AppLock
} from './crypto.ts';
import { exportArchive } from './export.ts';
import { checkThought, LIMITS, newId, type ThoughtFields } from '../thought.ts';
import { findTheme, THEMES } from '../themes.ts';
import type {
	ApiError,
	Lock,
	Me,
	MineItem,
	PublicCollection,
	PublicSettings,
	PublicThought,
	ServerInfo,
	SyncRequest,
	SyncResponse
} from '../wire.ts';

export interface MyThought extends ThoughtFields {
	id: string;
	/** When it was written (ms): the rotation order. */
	created: number;
	updatedAt: number;
	/** The public thought this was kept from, if any. */
	from: string | null;
}

/** What a personal record's JSON holds. */
type MinePayload = ThoughtFields & { created: number; from: string | null };

interface MineRecord extends MineItem {
	/** Changed here and not yet saved on the server. */
	dirty: boolean;
}

interface State {
	/** The database `since` and `mineSince` count in (`SyncResponse.db`). */
	db: string;
	since: number;
	mineSince: number;
	/** Account the personal records belong to; null while they are local only. */
	mineOwner: number | null;
	/** That account's email, to tell it from another one signing in here. */
	ownerEmail: string | null;
	lock: Lock | null;
	lockRev: number;
	me: Me | null;
	settings: PublicSettings;
	/** The reader changed their theme while signed in and it has not synced yet. */
	themeDirty: boolean;
	/** Same, for the reader's language. */
	localeDirty: boolean;
	lastSync: number | null;
	/** The server's build, as last seen. */
	server: ServerInfo | null;
}

const DEFAULT_SETTINGS: PublicSettings = {
	site_name: 'Qoddy',
	// Until the server says so, nothing invites readers to create an account.
	allow_sign_up: false,
	default_theme: THEMES[0].id,
	home: null
};

const INITIAL: State = {
	db: '',
	since: 0,
	mineSince: 0,
	mineOwner: null,
	ownerEmail: null,
	lock: null,
	lockRev: 0,
	me: null,
	settings: DEFAULT_SETTINGS,
	themeDirty: false,
	localeDirty: false,
	lastSync: null,
	server: null
};

const THEME_KEY = 'qoddy.theme';
const MODE_KEY = 'qoddy.mode';
const HOME_KEY = 'qoddy.home';
const ACCENT_KEY = 'qoddy.accent';
const TONE_KEY = 'qoddy.tone';
const SYNC_EVERY = 5 * 60_000;
/** The app lock's settings in `meta`, stored unencrypted. */
const APP_LOCK = 'applock';
/** With the app lock on, the app locks again after being away this long. */
const LOCK_AFTER = 5 * 60_000;

export type Mode = 'light' | 'dark' | null;

/** A failure to show the reader, in their terms. */
export class LibraryError extends Error {
	field?: string;
	constructor(message: string, field?: string) {
		super(message);
		this.field = field;
	}
}

/** Signing in here would discard changes another account made on this device. */
export class UnsyncedError extends LibraryError {
	count: number;
	owner: string | null;
	constructor(count: number, owner: string | null) {
		super(t.account.switchConfirm(count, owner));
		this.count = count;
		this.owner = owner;
	}
}

/** A failed request's error in the reader's language, or the server's own words. */
async function failed(response: Response): Promise<LibraryError> {
	const json = (await response.json().catch(() => ({}))) as Partial<ApiError>;
	const message =
		(json.code && t.serverErrors[json.code]) || json.error || t.errors.server(response.status);
	return new LibraryError(message, json.field);
}

function byCreated(a: MyThought, b: MyThought): number {
	return a.created - b.created || (a.id < b.id ? -1 : 1);
}

class Library {
	/** Loaded from this device; the app can render. */
	ready = $state(false);
	online = $state(typeof navigator === 'undefined' ? true : navigator.onLine);
	syncing = $state(false);
	/** Why the last sync failed, if it did. */
	syncError = $state<string | null>(null);

	#state = $state<State>({ ...INITIAL });
	collections = $state.raw<PublicCollection[]>([]);
	/** Public thoughts by id. */
	thoughts = $state.raw<Map<string, PublicThought>>(new Map());
	/** Your readable thoughts, oldest first. */
	mine = $state.raw<MyThought[]>([]);
	/** Your thoughts this device cannot read until you unlock. */
	sealed = $state(0);
	/** Your changes not yet on the server (signed in only). */
	pending = $state(0);
	/** How the app lock opens on this device, if it is on. */
	appLock = $state<AppLock['kind'] | null>(null);
	/** The app lock is on and not yet opened: nothing is loaded. */
	appLocked = $state(false);

	/** This device's theme choice (signed out), or the last one seen from the account. */
	#deviceTheme = $state<string | null>(null);
	mode = $state<Mode>(null);
	/** This device puts your own thoughts on the home page, whatever the site's choice. */
	homeMine = $state(false);
	#deviceAccent = $state<string | null>(null);
	#deviceTone = $state<string | null>(null);

	#records = new Map<string, MineRecord>();
	#keys = new Map<string, CryptoKey>();
	#running: Promise<void> | null = null;
	#again = false;
	#timer: ReturnType<typeof setTimeout> | undefined;
	#appLockSettings: AppLock | null = null;
	/** The app lock's data key, while the app is open. */
	#dataKey: CryptoKey | null = null;
	/** A sign-in the reader asked for may replace another account's thoughts. */
	#switching = false;
	#hiddenAt = 0;
	/** Tells this device's other tabs to start over (app lock changes, erase). */
	#channel: BroadcastChannel | null = null;

	get settings(): PublicSettings {
		return this.#state.settings;
	}
	get me(): Me | null {
		return this.#state.me;
	}
	get lock(): Lock | null {
		return this.#state.lock;
	}
	/** Signed in to an account this device's thoughts belong to. */
	get signedIn(): boolean {
		return this.#state.me !== null;
	}
	/** The collection is locked and this device does not hold the key. */
	get locked(): boolean {
		void this.#keyVersion;
		const lock = this.#state.lock;
		return lock !== null && !this.#keys.has(lock.key);
	}
	get lastSync(): number | null {
		return this.#state.lastSync;
	}
	/** For Account → Stats for nerds. */
	get stats() {
		const state = this.#state;
		return {
			db: state.db,
			since: state.since,
			mineSince: state.mineSince,
			server: state.server,
			records: this.#records.size,
			keys: this.#keys.size
		};
	}
	/** Bumped when keys change, so `locked` re-evaluates. */
	#keyVersion = $state(0);

	/** The reader's theme: the account's, else this device's, else the site's. */
	get theme(): string {
		const id = this.#state.me?.theme ?? this.#deviceTheme ?? this.#state.settings.default_theme;
		return findTheme(id)?.id ?? THEMES[0].id;
	}
	/** The reader's accent color: the account's when signed in, else this device's; null keeps the default. */
	get accent(): string | null {
		return this.#state.me ? (this.#state.me.accent ?? null) : this.#deviceAccent;
	}
	/** The tone the reader's paper takes on; null keeps the theme's paper. */
	get tone(): string | null {
		return this.#state.me ? (this.#state.me.tone ?? null) : this.#deviceTone;
	}

	// --- Reading -----------------------------------------------------------------

	collection(slug: string): PublicCollection | undefined {
		return this.collections.find((collection) => collection.slug === slug);
	}

	/** The collection whose thought of the day is the home page; null for your own thoughts. */
	get homeId(): number | null {
		return this.homeMine ? null : this.#state.settings.home;
	}

	isHome(collection: PublicCollection): boolean {
		return collection.id === this.homeId;
	}

	/** A collection's thoughts in rotation order. */
	thoughtsIn(collectionId: number): PublicThought[] {
		return [...this.thoughts.values()]
			.filter((thought) => thought.collection_id === collectionId)
			.sort((a, b) => a.seq - b.seq);
	}

	countIn(collectionId: number): number {
		let count = 0;
		for (const thought of this.thoughts.values())
			if (thought.collection_id === collectionId) count++;
		return count;
	}

	mineById(id: string): MyThought | undefined {
		return this.mine.find((thought) => thought.id === id);
	}

	/** Your copy of a public thought, if you kept it. */
	keptFrom(publicId: string): MyThought | undefined {
		return this.mine.find((thought) => thought.from === publicId);
	}

	// --- Start -------------------------------------------------------------------

	async init(): Promise<void> {
		this.#deviceTheme = stored(THEME_KEY);
		const mode = stored(MODE_KEY);
		this.mode = mode === 'light' || mode === 'dark' ? mode : null;
		this.homeMine = stored(HOME_KEY) === 'mine';
		this.#deviceAccent = stored(ACCENT_KEY);
		this.#deviceTone = stored(TONE_KEY);
		if (typeof BroadcastChannel !== 'undefined') {
			this.#channel = new BroadcastChannel('qoddy');
			this.#channel.onmessage = (event) => {
				if (event.data === 'reload') location.reload();
			};
		}
		try {
			this.#appLockSettings = (await idb.getPlain<AppLock>('meta', APP_LOCK)) ?? null;
		} catch (error) {
			console.warn('Qoddy: could not read local data', error);
		}
		this.appLock = this.#appLockSettings?.kind ?? null;
		if (this.#appLockSettings) {
			this.appLocked = true;
			return;
		}
		await this.#start();
	}

	/** Opens the app lock with its passcode or password, then starts the app. */
	async unlockApp(secret: string): Promise<void> {
		const settings = this.#appLockSettings;
		if (!settings || !this.appLocked) return;
		const key = await openAppLock(settings, secret);
		if (!key) throw new LibraryError(t.appLock.wrong, 'secret');
		this.#dataKey = key;
		idb.useCipher(key);
		this.appLocked = false;
		await this.#start();
	}

	async #start(): Promise<void> {
		await this.#load();
		await this.#rebuild();
		this.ready = true;

		addEventListener('online', () => {
			this.online = true;
			void this.sync();
		});
		addEventListener('offline', () => (this.online = false));
		document.addEventListener('visibilitychange', () => {
			if (document.visibilityState === 'hidden') {
				this.#hiddenAt = Date.now();
				return;
			}
			// Away long enough with the app lock on: start over, locked.
			if (this.appLock && this.#hiddenAt && Date.now() - this.#hiddenAt > LOCK_AFTER) {
				location.reload();
				return;
			}
			void this.sync();
		});
		setInterval(() => void this.sync(), SYNC_EVERY);
		void this.sync();
	}

	/** Everything stored on this device, decrypted with the app lock's key when it is on. */
	async #readAll() {
		const [meta, collections, thoughts, records, keys] = await Promise.all([
			idb.entries<unknown>('meta'),
			idb.getAll<PublicCollection>('collections'),
			idb.getAll<PublicThought>('thoughts'),
			idb.getAll<MineRecord>('mine'),
			// A CryptoKey (older versions, or no app lock), or its raw bytes (app lock).
			idb.entries<CryptoKey | string>('keys')
		]);
		return { meta, collections, thoughts, records, keys };
	}

	/** Loads this device's data into memory, replacing what is there. */
	async #load(): Promise<void> {
		try {
			const data = await this.#readAll();
			const saved = data.meta.find(([key]) => key === 'state')?.[1] as Partial<State> | undefined;
			// State saved by an older version may lack newer keys until the next sync.
			this.#state = { ...INITIAL, ...saved, settings: { ...DEFAULT_SETTINGS, ...saved?.settings } };
			this.collections = data.collections;
			this.thoughts = new Map(data.thoughts.map((thought) => [thought.id, thought]));
			this.#records = new Map(data.records.map((record) => [record.id, record]));
			const keys = new Map<string, CryptoKey>();
			for (const [id, value] of data.keys) {
				if (value instanceof CryptoKey) keys.set(String(id), value);
				else if (typeof value === 'string') keys.set(String(id), await importKey(value));
			}
			this.#keys = keys;
			this.#keyVersion++;
		} catch (error) {
			console.warn('Qoddy: could not read local data', error);
		}
	}

	/** Catches up with what other tabs of this app stored meanwhile. */
	async refresh(): Promise<void> {
		// Without storage, memory is all there is: reloading would lose it.
		if (!this.ready || !(await idb.available())) return;
		await this.#running;
		await this.#load();
		await this.#rebuild();
	}

	/** A key as this device stores it: as is, or its raw bytes encrypted under the app lock. */
	async #keyChange(id: string, key: CryptoKey): Promise<idb.Change[]> {
		if (!this.#dataKey) return [{ store: 'keys', key: id, put: key }];
		const raw = await exportKey(key);
		// A key from an older version cannot be stored under the app lock: it lasts this session.
		return raw === null ? [] : [{ store: 'keys', key: id, put: raw }];
	}

	// --- Sync --------------------------------------------------------------------

	/** Syncs now; concurrent calls share one run (and ask it to go again). */
	sync(): Promise<void> {
		if (this.#running) {
			this.#again = true;
			return this.#running;
		}
		this.#running = (async () => {
			this.syncing = true;
			try {
				for (let round = 0; round < 4; round++) {
					this.#again = false;
					await this.#syncOnce();
					if (!this.#again) break;
				}
			} finally {
				this.syncing = false;
				this.#running = null;
			}
		})();
		return this.#running;
	}

	#soon(): void {
		clearTimeout(this.#timer);
		this.#timer = setTimeout(() => void this.sync(), 800);
	}

	async #post(body: SyncRequest): Promise<SyncResponse> {
		const response = await fetch('/api/sync', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		});
		if (!response.ok) throw await failed(response);
		return response.json();
	}

	async #syncOnce(): Promise<void> {
		if (!navigator.onLine) {
			this.online = false;
			return;
		}
		const state = this.#state;
		const request: SyncRequest = {
			db: state.db,
			since: state.since,
			mineSince: state.mineSince
		};
		if (state.themeDirty && state.me) {
			request.theme = state.me.theme;
			request.accent = state.me.accent ?? null;
			request.tone = state.me.tone ?? null;
		}
		if (state.localeDirty && state.me) request.locale = state.me.locale;
		// Personal changes go up only to the account they belong to.
		const pushed = state.mineOwner !== null ? await this.#outgoing() : [];
		if (pushed.length) {
			request.mine = { items: pushed };
			// Ignored by the server if this browser is now signed in as someone else.
			request.owner = state.mineOwner!;
		}
		let response: SyncResponse;
		try {
			response = await this.#post(request);
			this.online = true;
			this.syncError = null;
		} catch (error) {
			this.syncError = error instanceof LibraryError ? error.message : t.errors.unreachable;
			return;
		}
		await this.#apply(response, request, pushed);
	}

	/** Dirty records, sealed with the collection's current key where they can be. */
	async #outgoing(): Promise<MineItem[]> {
		const target = this.#state.lock?.key ?? '';
		const items: MineItem[] = [];
		const changes: idb.Change[] = [];
		for (const record of this.#records.values()) {
			if (!record.dirty) continue;
			let item: MineItem = record;
			if (!record.deleted && record.key !== target) {
				// Written before the lock changed (or before signing in): re-seal it.
				const json = await this.#open(record);
				if (json === null || (target && !this.#keys.has(target))) continue;
				const data = target ? await encryptItem(this.#keys.get(target)!, record.id, json) : json;
				item = { ...record, data, key: target };
				this.#records.set(record.id, { ...item, dirty: true });
				changes.push({ store: 'mine', put: { ...item, dirty: true } });
			}
			const { dirty: _, ...plain } = item as MineRecord;
			items.push(plain);
		}
		await idb.write(changes);
		return items;
	}

	async #apply(response: SyncResponse, request: SyncRequest, pushed: MineItem[]): Promise<void> {
		const state = { ...this.#state };
		const changes: idb.Change[] = [];

		if (response.reset) {
			// Another database, or one behind this device (restored): start over.
			changes.push({ store: 'thoughts', clear: true }, { store: 'collections', clear: true });
			this.thoughts = new Map();
			this.collections = [];
			state.since = 0;
			state.mineSince = 0;
			this.#again = true;
		}

		if (response.settings) state.settings = response.settings;
		if (response.collections.length) {
			const collections = new Map(this.collections.map((c) => [c.id, c]));
			for (const { deleted, ...collection } of response.collections) {
				if (deleted) {
					collections.delete(collection.id);
					changes.push({ store: 'collections', key: collection.id });
				} else {
					collections.set(collection.id, collection);
					changes.push({ store: 'collections', put: collection });
				}
			}
			this.collections = [...collections.values()];
		}
		if (response.thoughts.length) {
			const thoughts = new Map(this.thoughts);
			for (const { deleted, ...thought } of response.thoughts) {
				if (deleted) {
					thoughts.delete(thought.id);
					changes.push({ store: 'thoughts', key: thought.id });
				} else {
					thoughts.set(thought.id, thought);
					changes.push({ store: 'thoughts', put: thought });
				}
			}
			this.thoughts = thoughts;
		}
		state.db = response.db;
		state.since = response.rev;
		// Older servers do not say.
		if (response.server) state.server = response.server;

		// Accounts: adopt local-only thoughts, or drop another account's.
		let me = response.me;
		const another =
			me !== null &&
			state.mineOwner !== null &&
			(state.mineOwner !== me.id || (state.ownerEmail !== null && state.ownerEmail !== me.email));
		let held = false;
		if (another && !this.#switching && this.#unsynced() > 0) {
			// Signed in as someone else (in another tab) while this device holds
			// changes of the account it belongs to. Keep them: until the reader
			// signs in here, this device acts as signed out.
			me = null;
			held = true;
		}
		if (response.reset && me && !another && state.mineOwner === me.id) {
			// A restored server may lack thoughts this device has: offer them all
			// again. Where the server's copy is as new or newer, it wins below.
			for (const record of this.#records.values()) {
				if (record.dirty) continue;
				const dirty = { ...record, dirty: true };
				this.#records.set(record.id, dirty);
				changes.push({ store: 'mine', put: dirty });
			}
		}
		// The personal part of this response is complete only if it was asked
		// for this account, or from the start.
		let mineComplete = true;
		if (me && another) {
			this.#forgetMine(changes, state);
		}
		if (me && state.mineOwner !== me.id) {
			mineComplete = request.mineSince === 0;
			// A first sign-in keeps the look chosen on this device, if the account has none.
			if (
				me.accent === null &&
				me.tone === null &&
				(this.#deviceAccent || this.#deviceTone) &&
				!state.themeDirty
			) {
				state.me = { ...me, accent: this.#deviceAccent, tone: this.#deviceTone };
				state.themeDirty = true;
			}
			state.mineOwner = me.id;
			state.mineSince = 0;
			// Push the adopted local thoughts (and pull what is missing) next round.
			this.#again = true;
		}
		if (me) {
			state.ownerEmail = me.email;
			if (request.theme !== undefined) state.themeDirty = false;
			if (request.locale !== undefined) state.localeDirty = false;
			// What this device changed and has not sent yet wins over the account's.
			const look = state.themeDirty && state.me ? state.me : me;
			const theme = look.theme;
			const accent = look.accent ?? null;
			const tone = look.tone ?? null;
			const locale = state.localeDirty && state.me ? state.me.locale : me.locale;
			state.me = { ...me, theme, locale, accent, tone };
			if (theme) {
				this.#deviceTheme = theme;
				store(THEME_KEY, theme);
			}
			// Signed out later, this device keeps the account's look.
			this.#deviceAccent = accent;
			this.#deviceTone = tone;
			store(ACCENT_KEY, accent);
			store(TONE_KEY, tone);
			// An account without a language keeps this device's.
			if (locale) i18n.set(locale);
		} else if (state.me) {
			// The session ended (signed out elsewhere, or expired). The thoughts
			// stay on this device until the reader signs in or out here.
			state.me = null;
		}

		if (me && response.mine && mineComplete) {
			const rejected = new Map(response.mine.rejected.map((r) => [r.id, r.reason]));
			for (const item of pushed) {
				const local = this.#records.get(item.id);
				if (!local || rejected.has(item.id) || local.updatedAt !== item.updatedAt) continue;
				this.#settle(item, changes);
			}
			for (const item of response.mine.items) {
				const local = this.#records.get(item.id);
				// Ours is newer: it goes up on the next push.
				if (local?.dirty && local.updatedAt > item.updatedAt) continue;
				this.#settle(item, changes);
			}
			if ([...rejected.values()].includes('lock')) this.#again = true;
			if ([...rejected.values()].includes('limit')) {
				this.syncError = t.errors.full;
			}
			state.lock = response.mine.lock;
			state.lockRev = response.mine.lockRev;
			state.mineSince = response.rev;
		}

		state.lastSync = Date.now();
		this.#state = state;
		changes.push({ store: 'meta', key: 'state', put: $state.snapshot(state) });
		await idb.write(changes);
		await this.#rebuild();
		if (held) this.syncError = t.errors.otherAccount(state.ownerEmail);
	}

	/** Records changed here and not yet on the server. */
	#unsynced(): number {
		let count = 0;
		for (const record of this.#records.values()) if (record.dirty) count++;
		return count;
	}

	/** Records the server's copy as this device's, clean. Tombstones are dropped. */
	#settle(item: MineItem, changes: idb.Change[]): void {
		if (item.deleted) {
			this.#records.delete(item.id);
			changes.push({ store: 'mine', key: item.id });
			return;
		}
		const record: MineRecord = {
			id: item.id,
			data: item.data,
			key: item.key,
			updatedAt: item.updatedAt,
			deleted: false,
			dirty: false
		};
		this.#records.set(item.id, record);
		changes.push({ store: 'mine', put: record });
	}

	#forgetMine(changes: idb.Change[], state: State): void {
		this.#records.clear();
		this.#keys.clear();
		this.#keyVersion++;
		changes.push({ store: 'mine', clear: true }, { store: 'keys', clear: true });
		state.mineOwner = null;
		state.ownerEmail = null;
		state.mineSince = 0;
		state.lock = null;
		state.lockRev = 0;
	}

	/** A record's JSON, decrypting it if this device holds its key. */
	async #open(record: MineRecord): Promise<string | null> {
		if (record.key === '') return record.data;
		const key = this.#keys.get(record.key);
		return key ? decryptItem(key, record.id, record.data) : null;
	}

	async #rebuild(): Promise<void> {
		const mine: MyThought[] = [];
		let sealed = 0;
		let pending = 0;
		for (const record of this.#records.values()) {
			if (record.dirty) pending++;
			if (record.deleted) continue;
			const json = await this.#open(record);
			if (json === null) {
				sealed++;
				continue;
			}
			try {
				const payload = JSON.parse(json) as MinePayload;
				const checked = checkThought(payload);
				if (!checked.ok) continue;
				mine.push({
					...checked.value,
					id: record.id,
					created: Number(payload.created) || record.updatedAt,
					updatedAt: record.updatedAt,
					from: typeof payload.from === 'string' ? payload.from : null
				});
			} catch {
				sealed++;
			}
		}
		this.mine = mine.sort(byCreated);
		this.sealed = sealed;
		this.pending = this.#state.mineOwner !== null ? pending : 0;
	}

	// --- Your thoughts -----------------------------------------------------------

	/** Saves a new or edited thought of yours; returns its id. */
	async saveMine(
		input: Record<string, unknown>,
		options: { id?: string; from?: string | null } = {}
	): Promise<string> {
		const checked = checkThought(input);
		if (!checked.ok) {
			const limit = LIMITS[checked.field as keyof typeof LIMITS] ?? 0;
			throw new LibraryError(t.thoughtErrors(checked.code, limit), checked.field);
		}
		const key = this.#writeKey();
		const id = options.id ?? newId();
		const previous = this.mine.find((thought) => thought.id === id);
		const payload: MinePayload = {
			...checked.value,
			created: previous?.created ?? Date.now(),
			from: options.from ?? previous?.from ?? null
		};
		const json = JSON.stringify(payload);
		const record: MineRecord = {
			id,
			data: key ? await encryptItem(this.#keys.get(key)!, id, json) : json,
			key,
			updatedAt: this.#stamp(id),
			deleted: false,
			dirty: true
		};
		await this.#write(record);
		this.#persist();
		return id;
	}

	/** Asks the browser not to evict this device's data under storage pressure. */
	#persist(): void {
		const storage = navigator.storage;
		if (!storage?.persist) return;
		void storage
			.persisted()
			.then((already) => already || storage.persist())
			.catch(() => undefined);
	}

	async deleteMine(id: string): Promise<void> {
		if (!this.#records.has(id)) return;
		await this.#write({
			id,
			data: '',
			key: '',
			updatedAt: this.#stamp(id),
			deleted: true,
			dirty: true
		});
	}

	/** Keeps a copy of a public thought in your collection. */
	keep(thought: PublicThought): Promise<string> {
		const { id, seq: _, collection_id: __, ...fields } = thought;
		return this.saveMine(fields, { from: id });
	}

	/** The key new writes use; refuses while the collection is locked here. */
	#writeKey(): string {
		const lock = this.#state.mineOwner !== null ? this.#state.lock : null;
		if (lock && !this.#keys.has(lock.key)) throw new LibraryError(t.errors.unlockFirst);
		return lock?.key ?? '';
	}

	/** Newer than both the clock and the record's last change, so edits always order. */
	#stamp(id: string): number {
		return Math.max(Date.now(), (this.#records.get(id)?.updatedAt ?? 0) + 1);
	}

	async #write(record: MineRecord): Promise<void> {
		this.#records.set(record.id, record);
		await idb.write([{ store: 'mine', put: record }]);
		await this.#rebuild();
		if (this.#state.mineOwner !== null) this.#soon();
	}

	// --- Account -----------------------------------------------------------------

	async #auth(body: Record<string, string>): Promise<void> {
		let response: Response;
		try {
			response = await fetch('/api/auth', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(body)
			});
		} catch {
			throw new LibraryError(t.errors.offline);
		}
		if (!response.ok) throw await failed(response);
	}

	/**
	 * Signs in. If this device holds unsynced changes of another account (whose
	 * session ended), refuses with `UnsyncedError` unless `discard` is set.
	 */
	async signIn(email: string, password: string, discard = false): Promise<void> {
		await this.#entering(email, discard, () => this.#auth({ action: 'signin', email, password }));
	}

	/** A new account starts in the language the app is showing: the browser's, unless the reader chose. */
	async signUp(name: string, email: string, password: string, discard = false): Promise<void> {
		await this.#entering(null, discard, () =>
			this.#auth({ action: 'signup', name, email, password, locale: i18n.locale })
		);
	}

	async #entering(email: string | null, discard: boolean, auth: () => Promise<void>) {
		// Another tab may have written since this one loaded.
		await this.refresh();
		const owner = this.#state.ownerEmail ?? this.#state.me?.email ?? null;
		const same = email !== null && owner === email.trim().toLowerCase();
		const unsynced = this.#state.mineOwner !== null && !same ? this.#unsynced() : 0;
		if (unsynced > 0 && !discard) throw new UnsyncedError(unsynced, owner);
		await auth();
		this.#switching = true;
		try {
			await this.sync();
		} finally {
			this.#switching = false;
		}
	}

	/**
	 * Deletes the account and everything in it on the server, at once, and the
	 * account's thoughts on this device. Export first to keep them.
	 */
	async deleteAccount(): Promise<void> {
		if (!this.signedIn) return;
		await this.#auth({ action: 'delete' });
		const state: State = {
			...this.#state,
			me: null,
			themeDirty: false,
			localeDirty: false
		};
		const changes: idb.Change[] = [];
		this.#forgetMine(changes, state);
		this.#state = state;
		changes.push({ store: 'meta', key: 'state', put: $state.snapshot(state) });
		await idb.write(changes);
		await this.#rebuild();
	}

	/**
	 * Your thoughts as Markdown files in a zip, made here: those the account
	 * has (`synced/`) and those only on this device so far (`this-device/`).
	 */
	async exportThoughts(): Promise<Blob> {
		if (this.signedIn && this.online) await this.sync();
		if (this.sealed > 0) throw new LibraryError(t.errors.unlockToExport);
		const account = this.#state.mineOwner !== null;
		return exportArchive(
			this.mine.map((thought) => ({
				thought,
				synced: account && this.#records.get(thought.id)?.dirty === false
			}))
		);
	}

	/** Signs out and removes your thoughts from this device (they stay in the account). */
	async signOut(): Promise<void> {
		await this.sync();
		await this.#auth({ action: 'signout' });
		const state = { ...this.#state, me: null, themeDirty: false, localeDirty: false };
		const changes: idb.Change[] = [];
		this.#forgetMine(changes, state);
		this.#state = state;
		changes.push({ store: 'meta', key: 'state', put: $state.snapshot(state) });
		await idb.write(changes);
		await this.#rebuild();
	}

	// --- Lock --------------------------------------------------------------------

	/** Unlocks the collection on this device with its password. */
	async unlock(password: string): Promise<void> {
		const lock = this.#state.lock;
		if (!lock) return;
		const key = await openLock(lock, password);
		if (!key) throw new LibraryError(t.errors.wrongLockPassword, 'password');
		this.#keys.set(lock.key, key);
		this.#keyVersion++;
		await idb.write(await this.#keyChange(lock.key, key));
		await this.#rebuild();
		void this.sync();
	}

	/** Forgets the key on this device; the password is needed to read again. */
	async lockDevice(): Promise<void> {
		this.#keys.clear();
		this.#keyVersion++;
		await idb.write([{ store: 'keys', clear: true }]);
		await this.#rebuild();
	}

	/**
	 * Locks the collection with a new password, or removes the lock (`null`).
	 * Every thought is re-sealed here and sent at once; the server refuses the
	 * change if another device wrote meanwhile, and then this asks to retry.
	 */
	async setLock(password: string | null): Promise<void> {
		if (!this.signedIn) throw new LibraryError(t.errors.signInToLock);
		if (!navigator.onLine) throw new LibraryError(t.account.lockNeedsConnection);
		await this.sync();
		if (this.locked || this.sealed > 0) throw new LibraryError(t.errors.unlockFirst);
		const next = password ? await createLock(password) : null;
		const items: MineItem[] = [];
		for (const record of this.#records.values()) {
			if (record.deleted) {
				if (record.dirty) items.push({ ...record, data: '', key: '' });
				continue;
			}
			const json = (await this.#open(record))!;
			items.push({
				id: record.id,
				data: next ? await encryptItem(next.key, record.id, json) : json,
				key: next?.lock.key ?? '',
				updatedAt: record.updatedAt,
				deleted: false
			});
		}
		const response = await this.#post({
			db: this.#state.db,
			since: this.#state.since,
			mineSince: this.#state.mineSince,
			owner: this.#state.mineOwner ?? undefined,
			mine: { lock: { base: this.#state.lockRev, value: next?.lock ?? null }, items }
		});
		const refused = response.mine?.rejected.some((r) => r.reason === 'lock');
		if (next && !refused) {
			this.#keys.set(next.lock.key, next.key);
			this.#keyVersion++;
			await idb.write(await this.#keyChange(next.lock.key, next.key));
		}
		await this.#apply(
			response,
			{ db: this.#state.db, since: 0, mineSince: this.#state.mineSince },
			refused ? [] : items
		);
		if (refused) {
			throw new LibraryError(t.errors.changedElsewhere);
		}
	}

	// --- App lock ----------------------------------------------------------------

	/**
	 * Turns the app lock on, or changes its passcode or password. Turning it on
	 * encrypts everything stored here; a new passcode only re-wraps the key.
	 */
	async setAppLock(kind: AppLock['kind'], secret: string): Promise<void> {
		// Nothing is stored here (some private modes): there would be nothing to lock.
		if (!(await idb.available())) throw new LibraryError(t.appLock.failed);
		if (this.#dataKey) {
			const { lock } = await createAppLock(kind, secret, this.#dataKey);
			await idb.write([{ store: 'meta', key: APP_LOCK, put: lock, plain: true }]);
			this.#appLockSettings = lock;
			this.appLock = kind;
			this.#channel?.postMessage('reload');
			return;
		}
		const { lock, key } = await createAppLock(kind, secret);
		await this.#rewrite(key, lock);
	}

	/** Turns the app lock off: everything is stored unencrypted again. */
	async removeAppLock(): Promise<void> {
		if (this.#dataKey) await this.#rewrite(null, null);
	}

	/** Locks the app now (it starts over, asking for the passcode). */
	lockApp(): void {
		location.reload();
	}

	/**
	 * Erases everything stored on this device: for a forgotten passcode.
	 * The account's thoughts come back on signing in; the rest is gone.
	 */
	async eraseDevice(): Promise<void> {
		await idb.erase();
		this.#channel?.postMessage('reload');
		location.reload();
	}

	/** Stores everything again, under `key` (or plainly), in one transaction. */
	async #rewrite(key: CryptoKey | null, lock: AppLock | null): Promise<void> {
		await this.#running;
		// Read from storage, not memory: it also holds what other tabs wrote.
		const data = await this.#readAll();
		const changes: idb.Change[] = [
			...data.collections.map((put) => ({ store: 'collections' as const, put })),
			...data.thoughts.map((put) => ({ store: 'thoughts' as const, put })),
			...data.records.map((put) => ({ store: 'mine' as const, put })),
			...data.meta
				.filter(([id]) => id !== APP_LOCK)
				.map(([id, put]) => ({ store: 'meta' as const, key: id, put }))
		];
		for (const [id, value] of data.keys) {
			if (key) {
				// Encrypted, as raw bytes; a key from an older version lasts this session.
				const raw = typeof value === 'string' ? value : await exportKey(value);
				changes.push(
					raw === null ? { store: 'keys', key: id } : { store: 'keys', key: id, put: raw }
				);
			} else {
				changes.push({
					store: 'keys',
					key: id,
					put: typeof value === 'string' ? await importKey(value) : value
				});
			}
		}
		changes.push(
			lock
				? { store: 'meta', key: APP_LOCK, put: lock, plain: true }
				: { store: 'meta', key: APP_LOCK }
		);
		const previous = this.#dataKey;
		idb.useCipher(key);
		try {
			await idb.write(changes);
		} catch (error) {
			idb.useCipher(previous);
			throw error;
		}
		this.#dataKey = key;
		this.#appLockSettings = lock;
		this.appLock = lock?.kind ?? null;
		// Other tabs still write the old way: they start over.
		this.#channel?.postMessage('reload');
	}

	// --- Appearance --------------------------------------------------------------

	setTheme(id: string): void {
		if (!findTheme(id)) return;
		this.#deviceTheme = id;
		store(THEME_KEY, id);
		if (this.#state.me) {
			this.#state = { ...this.#state, me: { ...this.#state.me, theme: id }, themeDirty: true };
			void idb.write([{ store: 'meta', key: 'state', put: $state.snapshot(this.#state) }]);
			this.#soon();
		}
	}

	/** The reader's accent (`#rrggbb`), or null for the default. */
	setAccent(color: string | null): void {
		this.#setColor('accent', color);
	}

	/** A tone for the reader's paper (`#rrggbb`), or null for the theme's own paper. */
	setTone(color: string | null): void {
		this.#setColor('tone', color);
	}

	#setColor(which: 'accent' | 'tone', color: string | null): void {
		if (which === 'accent') this.#deviceAccent = color;
		else this.#deviceTone = color;
		store(which === 'accent' ? ACCENT_KEY : TONE_KEY, color);
		if (this.#state.me) {
			this.#state = { ...this.#state, me: { ...this.#state.me, [which]: color }, themeDirty: true };
			void idb.write([{ store: 'meta', key: 'state', put: $state.snapshot(this.#state) }]);
			this.#soon();
		}
	}

	setMode(mode: Mode): void {
		this.mode = mode;
		store(MODE_KEY, mode);
	}

	/** Your own thoughts on the home page (on this device), or the site's collection. */
	setHomeMine(mine: boolean): void {
		this.homeMine = mine;
		store(HOME_KEY, mine ? 'mine' : null);
	}

	/** Shows the app in another language; signed in, the account remembers it. */
	setLocale(id: string): void {
		const locale = findLocale(id);
		if (!locale) return;
		i18n.set(locale);
		if (this.#state.me) {
			this.#state = { ...this.#state, me: { ...this.#state.me, locale }, localeDirty: true };
			void idb.write([{ store: 'meta', key: 'state', put: $state.snapshot(this.#state) }]);
			this.#soon();
		}
	}
}

export const library = new Library();
