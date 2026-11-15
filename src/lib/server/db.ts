// The SQLite database: opening, migrations, transactions, and revisions.
//
// Server modules import each other with relative `.ts` paths and never import
// `$app/*`, so `scripts/cli.ts` can run them directly under Node.
//
// Every synced row (settings, collections, thoughts, personal items and lock)
// carries `rev`, a value from one global counter that rises with each write.
// Clients ask for rows with `rev` above the last one they saw; deleted rows
// stay as tombstones so the deletion syncs too.

import { DatabaseSync } from 'node:sqlite';
import type { ErrorCode } from '../wire.ts';

export type Db = DatabaseSync;

/** Append only: each entry runs once, in order, tracked by `PRAGMA user_version`. */
const MIGRATIONS: string[] = [
	`
	CREATE TABLE user (
		id INTEGER PRIMARY KEY,
		email TEXT NOT NULL UNIQUE,
		name TEXT NOT NULL,
		password_hash TEXT NOT NULL,
		role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
		theme TEXT,
		created_at TEXT NOT NULL DEFAULT (datetime('now'))
	);
	CREATE TABLE session (
		id TEXT PRIMARY KEY,
		user_id INTEGER NOT NULL REFERENCES user (id) ON DELETE CASCADE,
		expires_at INTEGER NOT NULL
	);
	CREATE INDEX session_user ON session (user_id);
	CREATE TABLE revision (
		id INTEGER PRIMARY KEY CHECK (id = 1),
		value INTEGER NOT NULL
	);
	INSERT INTO revision VALUES (1, 1);
	CREATE TABLE settings (
		id INTEGER PRIMARY KEY CHECK (id = 1),
		site_name TEXT NOT NULL,
		allow_sign_up INTEGER NOT NULL,
		default_theme TEXT NOT NULL,
		daily INTEGER NOT NULL,
		rev INTEGER NOT NULL
	);
	INSERT INTO settings VALUES (1, 'Qoddy', 1, 'morning', 1, 1);
	CREATE TABLE collection (
		id INTEGER PRIMARY KEY,
		slug TEXT NOT NULL UNIQUE,
		name TEXT NOT NULL,
		description TEXT NOT NULL DEFAULT '',
		deleted INTEGER NOT NULL DEFAULT 0,
		rev INTEGER NOT NULL
	);
	INSERT INTO collection (slug, name, description, rev)
		VALUES ('default', 'Thought of the day', '', 1);
	CREATE TABLE thought (
		seq INTEGER PRIMARY KEY,
		id TEXT NOT NULL UNIQUE,
		collection_id INTEGER NOT NULL REFERENCES collection (id),
		text TEXT NOT NULL,
		author TEXT,
		source TEXT,
		notes TEXT,
		lang TEXT,
		theme TEXT,
		color TEXT,
		font TEXT,
		deleted INTEGER NOT NULL DEFAULT 0,
		rev INTEGER NOT NULL,
		created_at TEXT NOT NULL DEFAULT (datetime('now'))
	);
	CREATE INDEX thought_rev ON thought (rev);
	CREATE INDEX thought_collection ON thought (collection_id, deleted, seq);
	CREATE TABLE personal (
		user_id INTEGER PRIMARY KEY REFERENCES user (id) ON DELETE CASCADE,
		lock TEXT,
		rev INTEGER NOT NULL
	);
	CREATE TABLE personal_item (
		user_id INTEGER NOT NULL REFERENCES user (id) ON DELETE CASCADE,
		id TEXT NOT NULL,
		data TEXT NOT NULL,
		key TEXT NOT NULL DEFAULT '',
		updated_at INTEGER NOT NULL,
		deleted INTEGER NOT NULL DEFAULT 0,
		rev INTEGER NOT NULL,
		PRIMARY KEY (user_id, id)
	);
	CREATE INDEX personal_item_rev ON personal_item (user_id, rev);
	`,
	// The reader's language; null keeps whatever the device shows.
	`ALTER TABLE user ADD COLUMN locale TEXT;`,
	// The home page's collection replaces the `daily` flag; null shows the reader's own thoughts.
	// The new revision makes every device pull the changed settings.
	`
	ALTER TABLE settings ADD COLUMN home INTEGER REFERENCES collection (id);
	UPDATE settings SET home = (SELECT id FROM collection WHERE slug = 'default' AND deleted = 0)
		WHERE daily = 1;
	ALTER TABLE settings DROP COLUMN daily;
	UPDATE revision SET value = value + 1;
	UPDATE settings SET rev = (SELECT value FROM revision);
	`
];

function migrate(db: Db): void {
	const { user_version: version } = db.prepare('PRAGMA user_version').get() as {
		user_version: number;
	};
	for (let index = version; index < MIGRATIONS.length; index++) {
		transaction(db, () => {
			db.exec(MIGRATIONS[index]);
			db.exec(`PRAGMA user_version = ${index + 1}`);
		});
	}
}

export function open(path: string): Db {
	const db = new DatabaseSync(path);
	db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
	migrate(db);
	return db;
}

let shared: Db | undefined;

/** The app's database, at `DATABASE_PATH` (default `qoddy.db`). */
export function db(): Db {
	return (shared ??= open(process.env.DATABASE_PATH || 'qoddy.db'));
}

/**
 * Runs `work` in a write transaction, rolling back if it throws. Calls are
 * synchronous, so nothing else in this process interleaves with it.
 */
export function transaction<T>(db: Db, work: () => T): T {
	if (db.isTransaction) return work();
	db.exec('BEGIN IMMEDIATE');
	try {
		const result = work();
		db.exec('COMMIT');
		return result;
	} catch (error) {
		db.exec('ROLLBACK');
		throw error;
	}
}

/** Claims the next revision for a write. Call inside the write's transaction. */
export function nextRev(db: Db): number {
	const row = db
		.prepare('UPDATE revision SET value = value + 1 WHERE id = 1 RETURNING value')
		.get() as { value: number };
	return row.value;
}

/** The highest revision written so far. */
export function currentRev(db: Db): number {
	return (db.prepare('SELECT value FROM revision WHERE id = 1').get() as { value: number }).value;
}

/** A user-facing failure: bad input or a rule the action breaks. */
export class Invalid extends Error {
	field?: string;
	/** Set on failures readers meet, so the app can say them in the reader's language. */
	code?: ErrorCode;
	constructor(message: string, field?: string, code?: ErrorCode) {
		super(message);
		this.field = field;
		this.code = code;
	}
}
