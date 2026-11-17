// What travels over `/api/sync`, shared by the server and the browser.

import type { ThoughtFields } from './thought.ts';

/** Shortest account password, in characters. */
export const MIN_PASSWORD = 8;

/** Failures the reader can act on; the client shows them in the reader's language. */
export type ErrorCode =
	| 'wrong_password'
	| 'not_your_password'
	| 'email_invalid'
	| 'email_taken'
	| 'name_invalid'
	| 'password_short'
	| 'password_long'
	| 'sign_up_closed'
	| 'too_many_attempts'
	| 'last_admin';

/** The body of a failed `/api` request. `error` is English, for anything without a `code`. */
export interface ApiError {
	error: string;
	field?: string;
	code?: ErrorCode;
}

/**
 * Encryption parameters for a locked personal collection. The key comes from
 * the reader's account password (versions before 2026-11 used a separate one).
 */
export interface Lock {
	/** Id of the key every item is encrypted with. */
	key: string;
	/** PBKDF2 salt, base64. */
	salt: string;
	iterations: number;
	/** A known value encrypted with the key, to tell a wrong password. */
	check: { iv: string; data: string };
}

/** A personal thought as the server stores it. */
export interface MineItem {
	id: string;
	/** JSON of the thought, an encrypted envelope, or '' once deleted. */
	data: string;
	/** Key id `data` is encrypted with; '' for plain JSON. */
	key: string;
	updatedAt: number;
	deleted: boolean;
}

export interface PublicSettings {
	site_name: string;
	allow_sign_up: boolean;
	default_theme: string;
	/** Id of the public collection whose thought of the day is the home page; null shows the reader's own thoughts. */
	home: number | null;
}

export interface PublicCollection {
	id: number;
	slug: string;
	name: string;
	description: string;
}

export interface PublicThought extends ThoughtFields {
	id: string;
	/** Rotation order within the collection. */
	seq: number;
	collection_id: number;
	/** When it joined its collection (ms). Older servers and cached copies lack it: always there. */
	added?: number;
}

export interface Me {
	id: number;
	email: string;
	name: string;
	role: 'admin' | 'user';
	theme: string | null;
	/** The reader's language (`#lib/locales.ts`); null until they have one. */
	locale: string | null;
	/** The reader's accent color (`#rrggbb`); null keeps the default. */
	accent: string | null;
	/** A tone (`#rrggbb`) the reader's paper takes on; null keeps the theme's paper. */
	tone: string | null;
}

/** Which build the server runs, for the curious (Account → Stats for nerds). */
export interface ServerInfo {
	/** When the server's code was built (ISO time). */
	built: string;
	/** Git commit of the build, or '' when unknown. */
	commit: string;
	/** When the server process started (ms). */
	started: number;
}

export interface SyncRequest {
	/** The database the cursors below belong to (`SyncResponse.db`); '' before the first sync. */
	db: string;
	/** Highest `rev` already applied to this device's public data. */
	since: number;
	/** Same, for the personal collection (reset when the account changes). */
	mineSince: number;
	/** The reader's theme choice, when it changed on this device. */
	theme?: string | null;
	/** The reader's language choice, when it changed on this device. */
	locale?: string | null;
	/** The reader's colors, sent with `theme` when the look changed on this device. */
	accent?: string | null;
	tone?: string | null;
	/**
	 * The account the pushed `mine` items belong to. When the session is
	 * another account's (another tab signed in), the push is ignored, so one
	 * account's thoughts never land in another's. Older clients leave it out.
	 */
	owner?: number;
	mine?: {
		/** A new lock (or null to remove it), based on the lock at revision `base`. */
		lock?: { base: number; value: Lock | null };
		items: MineItem[];
	};
}

export type RejectReason = 'key' | 'lock' | 'limit';

export interface SyncResponse {
	/** The database's id: cursors from another one (a rebuilt database) start over. */
	db: string;
	rev: number;
	/** The device's cursors are from another database, or ahead of this one (restored): start over. */
	reset?: true;
	settings?: PublicSettings;
	collections: (PublicCollection & { deleted: boolean })[];
	thoughts: (PublicThought & { deleted: boolean })[];
	me: Me | null;
	server: ServerInfo;
	mine?: {
		lock: Lock | null;
		/** Revision of the lock, the `base` for changing it. */
		lockRev: number;
		items: MineItem[];
		/** Pushed items not saved: `key` (stale key), `lock` (lock changed first), `limit`. */
		rejected: { id: string; reason: RejectReason }[];
	};
}
