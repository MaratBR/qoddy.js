// What travels over `/api/sync`, shared by the server and the browser.

import type { ThoughtFields } from './thought.ts';

/** Encryption parameters for a locked personal collection. */
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
	/** The home page shows the default collection's thought of the day. */
	daily: boolean;
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
}

export interface Me {
	id: number;
	email: string;
	name: string;
	role: 'admin' | 'user';
	theme: string | null;
}

export interface SyncRequest {
	/** Highest `rev` already applied to this device's public data. */
	since: number;
	/** Same, for the personal collection (reset when the account changes). */
	mineSince: number;
	/** The reader's theme choice, when it changed on this device. */
	theme?: string | null;
	mine?: {
		/** A new lock (or null to remove it), based on the lock at revision `base`. */
		lock?: { base: number; value: Lock | null };
		items: MineItem[];
	};
}

export type RejectReason = 'key' | 'lock' | 'limit';

export interface SyncResponse {
	rev: number;
	/** The device's cursor is ahead of the server (restored database): start over. */
	reset?: true;
	settings?: PublicSettings;
	collections: (PublicCollection & { deleted: boolean })[];
	thoughts: (PublicThought & { deleted: boolean })[];
	me: Me | null;
	mine?: {
		lock: Lock | null;
		/** Revision of the lock, the `base` for changing it. */
		lockRev: number;
		items: MineItem[];
		/** Pushed items not saved: `key` (stale key), `lock` (lock changed first), `limit`. */
		rejected: { id: string; reason: RejectReason }[];
	};
}
