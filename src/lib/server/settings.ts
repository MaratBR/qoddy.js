// Site settings: one row, changed by admins (dashboard or CLI), synced to readers.

import { Invalid, nextRev, transaction, type Db } from './db.ts';
import { themeExists } from '../themes.ts';

export interface Settings {
	site_name: string;
	/** Anyone may create an account. */
	allow_sign_up: boolean;
	/** Theme for readers who have not chosen one. */
	default_theme: string;
	/** The home page shows the default collection's thought of the day. */
	daily: boolean;
}

export const SETTING_KEYS = ['site_name', 'allow_sign_up', 'default_theme', 'daily'] as const;

export function getSettings(db: Db): Settings & { rev: number } {
	const row = db
		.prepare(
			'SELECT site_name, allow_sign_up, default_theme, daily, rev FROM settings WHERE id = 1'
		)
		.get() as {
		site_name: string;
		allow_sign_up: number;
		default_theme: string;
		daily: number;
		rev: number;
	};
	return {
		site_name: row.site_name,
		allow_sign_up: row.allow_sign_up === 1,
		default_theme: row.default_theme,
		daily: row.daily === 1,
		rev: row.rev
	};
}

export function updateSettings(db: Db, changes: Partial<Settings>): Settings {
	const next = { ...getSettings(db), ...changes };
	next.site_name = next.site_name.trim();
	if (!next.site_name || next.site_name.length > 60) {
		throw new Invalid('Give the site a name (up to 60 characters).', 'site_name');
	}
	if (!themeExists(next.default_theme)) throw new Invalid('Choose a known theme.', 'default_theme');
	return transaction(db, () => {
		db.prepare(
			'UPDATE settings SET site_name = ?, allow_sign_up = ?, default_theme = ?, daily = ?, rev = ? WHERE id = 1'
		).run(next.site_name, +next.allow_sign_up, next.default_theme, +next.daily, nextRev(db));
		return getSettings(db);
	});
}

/** Sets one key from text (CLI). */
export function setSetting(db: Db, key: string, value: string): Settings {
	const flag = () => {
		if (value !== 'true' && value !== 'false') throw new Invalid('Expected true or false.');
		return value === 'true';
	};
	switch (key) {
		case 'site_name':
		case 'default_theme':
			return updateSettings(db, { [key]: value });
		case 'allow_sign_up':
		case 'daily':
			return updateSettings(db, { [key]: flag() });
		default:
			throw new Invalid(`Unknown setting; expected one of ${SETTING_KEYS.join(', ')}.`);
	}
}
