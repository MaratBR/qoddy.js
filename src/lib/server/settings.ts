// Site settings: one row, changed by admins (dashboard or CLI), synced to readers.

import { Invalid, nextRev, transaction, type Db } from './db.ts';
import { findCollection, MINE_SLUG } from './collections.ts';
import { themeExists } from '../themes.ts';

export interface Settings {
	site_name: string;
	/** Anyone may create an account. */
	allow_sign_up: boolean;
	/** Theme for readers who have not chosen one. */
	default_theme: string;
	/** The public collection whose thought of the day is the home page; null shows each reader's own thoughts. */
	home: number | null;
	/** Ask search engines not to index the site. The server's alone: never synced to readers. */
	hide_from_search: boolean;
}

export const SETTING_KEYS = [
	'site_name',
	'allow_sign_up',
	'default_theme',
	'home',
	'hide_from_search'
] as const;

export function getSettings(db: Db): Settings & { rev: number } {
	const row = db
		.prepare(
			'SELECT site_name, allow_sign_up, default_theme, home, hide_from_search, rev FROM settings WHERE id = 1'
		)
		.get() as {
		site_name: string;
		allow_sign_up: number;
		default_theme: string;
		home: number | null;
		hide_from_search: number;
		rev: number;
	};
	return {
		site_name: row.site_name,
		allow_sign_up: row.allow_sign_up === 1,
		default_theme: row.default_theme,
		home: row.home,
		hide_from_search: row.hide_from_search === 1,
		rev: row.rev
	};
}

/** The `home` setting for a collection's address, or `mine` for the reader's own thoughts. */
export function homeFromSlug(db: Db, slug: string): number | null {
	if (slug === MINE_SLUG) return null;
	const collection = findCollection(db, slug);
	if (!collection) throw new Invalid(`No collection ${slug}.`, 'home');
	return collection.id;
}

export function updateSettings(db: Db, changes: Partial<Settings>): Settings {
	return transaction(db, () => {
		const next = { ...getSettings(db), ...changes };
		next.site_name = next.site_name.trim();
		if (!next.site_name || next.site_name.length > 60) {
			throw new Invalid('Give the site a name (up to 60 characters).', 'site_name');
		}
		if (!themeExists(next.default_theme)) {
			throw new Invalid('Choose a known theme.', 'default_theme');
		}
		if (
			next.home !== null &&
			!db.prepare('SELECT 1 FROM collection WHERE id = ? AND deleted = 0').get(next.home)
		) {
			throw new Invalid('That collection no longer exists.', 'home');
		}
		db.prepare(
			`UPDATE settings SET site_name = ?, allow_sign_up = ?, default_theme = ?, home = ?,
				hide_from_search = ?, rev = ? WHERE id = 1`
		).run(
			next.site_name,
			+next.allow_sign_up,
			next.default_theme,
			next.home,
			+next.hide_from_search,
			nextRev(db)
		);
		return getSettings(db);
	});
}

/** Sets one key from text (CLI). `home` takes a collection's address, or `mine`. */
export function setSetting(db: Db, key: string, value: string): Settings {
	switch (key) {
		case 'site_name':
		case 'default_theme':
			return updateSettings(db, { [key]: value });
		case 'allow_sign_up':
		case 'hide_from_search':
			if (value !== 'true' && value !== 'false') throw new Invalid('Expected true or false.');
			return updateSettings(db, { [key]: value === 'true' });
		case 'home':
			return updateSettings(db, { home: homeFromSlug(db, value) });
		default:
			throw new Invalid(`Unknown setting; expected one of ${SETTING_KEYS.join(', ')}.`);
	}
}
