// Accounts and sessions.
//
// Passwords: scrypt (N=2^15, r=8, p=1), stored as `scrypt$N$r$p$salt$hash`.
// Sessions: a random token in an HttpOnly cookie; the database keeps only its
// SHA-256, so a leaked database cannot be replayed as cookies. Sessions slide:
// one used in its second half is extended. Signing out deletes the row.

import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { Invalid, transaction, type Db } from './db.ts';
import { getSettings } from './settings.ts';
import { themeExists } from '../themes.ts';
import { findLocale } from '../locales.ts';
import { normalizeColor } from '../thought.ts';
import { MIN_PASSWORD } from '../wire.ts';

export type Role = 'admin' | 'user';

export interface User {
	id: number;
	email: string;
	name: string;
	role: Role;
	/** Preferred theme id; null follows the site default. */
	theme: string | null;
	/** Preferred language (`#lib/locales.ts`); null keeps the device's. */
	locale: string | null;
	/** Accent color (`#rrggbb`); null keeps the default. */
	accent: string | null;
	/** Paper tone (`#rrggbb`); null keeps the theme's paper. */
	tone: string | null;
}

const SESSION_MS = 30 * 86_400_000;

const N = 2 ** 15;
const R = 8;
const P = 1;

function derive(password: string, salt: Buffer, n: number, r: number, p: number): Promise<Buffer> {
	return new Promise((resolve, reject) =>
		scrypt(
			password.normalize('NFC'),
			salt,
			32,
			{ N: n, r, p, maxmem: 256 * n * r },
			(error, key) => (error ? reject(error) : resolve(key))
		)
	);
}

export async function hashPassword(password: string): Promise<string> {
	const salt = randomBytes(16);
	const hash = await derive(password, salt, N, R, P);
	return ['scrypt', N, R, P, salt.toString('base64'), hash.toString('base64')].join('$');
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
	const [scheme, n, r, p, salt, hash] = stored.split('$');
	if (scheme !== 'scrypt' || !hash) return false;
	const expected = Buffer.from(hash, 'base64');
	const actual = await derive(password, Buffer.from(salt, 'base64'), +n, +r, +p);
	return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Checked when the email is unknown, so both failures take about as long. */
let dummyHash: Promise<string> | undefined;

const USER_COLUMNS = 'id, email, name, role, theme, locale, accent, tone';

/** Longest password checked, in UTF-16 units: longer ones cannot match (see `createUser`). */
const MAX_PASSWORD = 1024;

export function findUser(db: Db, id: number): User | undefined {
	return db.prepare(`SELECT ${USER_COLUMNS} FROM user WHERE id = ?`).get(id) as User | undefined;
}

export function listUsers(db: Db): User[] {
	return db.prepare(`SELECT ${USER_COLUMNS} FROM user ORDER BY id`).all() as unknown as User[];
}

/** A row of the dashboard's account list: no password hash. */
export interface Account extends User {
	/** SQLite `datetime('now')` text, UTC: `YYYY-MM-DD HH:MM:SS`. */
	created_at: string;
	/** Live (not deleted) synced personal thoughts. */
	thoughts: number;
}

export function listAccounts(db: Db): Account[] {
	return db
		.prepare(
			`SELECT ${USER_COLUMNS}, created_at,
				(SELECT count(*) FROM personal_item
					WHERE personal_item.user_id = user.id AND deleted = 0) AS thoughts
			FROM user ORDER BY id`
		)
		.all() as unknown as Account[];
}

export function findUserByEmail(db: Db, email: string): User | undefined {
	return db
		.prepare(`SELECT ${USER_COLUMNS} FROM user WHERE email = ?`)
		.get(normalizeEmail(email)) as User | undefined;
}

function normalizeEmail(email: string): string {
	return email.trim().toLowerCase();
}

export async function authenticate(db: Db, email: string, password: string): Promise<User | null> {
	if (password.length > MAX_PASSWORD) return null;
	const row = db
		.prepare(`SELECT ${USER_COLUMNS}, password_hash FROM user WHERE email = ?`)
		.get(normalizeEmail(email)) as (User & { password_hash: string }) | undefined;
	const stored = row?.password_hash ?? (await (dummyHash ??= hashPassword('dummy password')));
	const matches = await verifyPassword(password, stored);
	if (!row || !matches) return null;
	const { password_hash: _, ...user } = row;
	return user;
}

/** Creates an account regardless of the sign-up setting (CLI). */
export async function createUser(
	db: Db,
	input: { email: string; name: string; password: string; role?: Role; locale?: string }
): Promise<User> {
	const email = normalizeEmail(input.email);
	const name = input.name.trim();
	if (!/^[^\s@]+@[^\s@]+$/.test(email) || email.length > 254) {
		throw new Invalid('Enter a valid email address.', 'email', 'email_invalid');
	}
	if (!name || name.length > 100) {
		throw new Invalid('Enter a name (up to 100 characters).', 'name', 'name_invalid');
	}
	if ([...input.password].length < MIN_PASSWORD) {
		throw new Invalid(`Use at least ${MIN_PASSWORD} characters.`, 'password', 'password_short');
	}
	if (input.password.length > MAX_PASSWORD) {
		throw new Invalid('That password is too long.', 'password', 'password_long');
	}
	if (findUserByEmail(db, email)) {
		throw new Invalid('An account with this email already exists.', 'email', 'email_taken');
	}
	const hash = await hashPassword(input.password);
	const { lastInsertRowid } = db
		.prepare('INSERT INTO user (email, name, password_hash, role, locale) VALUES (?, ?, ?, ?, ?)')
		.run(email, name, hash, input.role ?? 'user', findLocale(input.locale) ?? null);
	return findUser(db, Number(lastInsertRowid))!;
}

/** Self-service sign-up, only while the site allows it. `locale` is the browser's language. */
export async function signUp(
	db: Db,
	input: { email: string; name: string; password: string; locale?: string }
): Promise<User> {
	if (!getSettings(db).allow_sign_up) {
		throw new Invalid('Sign-up is closed on this site.', undefined, 'sign_up_closed');
	}
	return createUser(db, { ...input, role: 'user' });
}

export function setRole(db: Db, email: string, role: Role): User {
	const user = findUserByEmail(db, email);
	if (!user) throw new Invalid(`No account with email ${email}.`);
	db.prepare('UPDATE user SET role = ? WHERE id = ?').run(role, user.id);
	return { ...user, role };
}

export async function setPassword(db: Db, email: string, password: string): Promise<void> {
	const user = findUserByEmail(db, email);
	if (!user) throw new Invalid(`No account with email ${email}.`);
	if ([...password].length < MIN_PASSWORD)
		throw new Invalid(`Use at least ${MIN_PASSWORD} characters.`);
	if (password.length > MAX_PASSWORD) throw new Invalid('That password is too long.');
	db.prepare('UPDATE user SET password_hash = ? WHERE id = ?').run(
		await hashPassword(password),
		user.id
	);
	// A new password signs every device out.
	db.prepare('DELETE FROM session WHERE user_id = ?').run(user.id);
}

/** Saves the reader's language; unknown ids clear it. */
export function setLocale(db: Db, user: User, locale: string | null): void {
	db.prepare('UPDATE user SET locale = ? WHERE id = ?').run(findLocale(locale) ?? null, user.id);
}

/** Saves the reader's theme; unknown ids clear it. */
export function setTheme(db: Db, user: User, theme: string | null): void {
	db.prepare('UPDATE user SET theme = ? WHERE id = ?').run(
		theme && themeExists(theme) ? theme : null,
		user.id
	);
}

/** Saves the reader's colors; anything but `#rrggbb` clears one. */
export function setColors(
	db: Db,
	user: User,
	colors: { accent?: string | null; tone?: string | null }
): void {
	const color = (value: string | null | undefined) => (value && normalizeColor(value)) || null;
	if (colors.accent !== undefined) {
		db.prepare('UPDATE user SET accent = ? WHERE id = ?').run(color(colors.accent), user.id);
	}
	if (colors.tone !== undefined) {
		db.prepare('UPDATE user SET tone = ? WHERE id = ?').run(color(colors.tone), user.id);
	}
}

/**
 * Deletes an account and everything it owns, at once: sessions, synced
 * thoughts and the lock go with it (ON DELETE CASCADE), and secure_delete
 * (`db.ts`) overwrites them in the file. The last admin cannot leave, or
 * nobody could run the dashboard.
 */
export function deleteAccount(db: Db, userId: number): void {
	transaction(db, () => {
		const user = findUser(db, userId);
		if (!user) return;
		if (user.role === 'admin') {
			const { n } = db.prepare("SELECT count(*) AS n FROM user WHERE role = 'admin'").get() as {
				n: number;
			};
			if (n <= 1) {
				throw new Invalid(
					'You are the only admin. Make someone else an admin first.',
					undefined,
					'last_admin'
				);
			}
		}
		db.prepare('DELETE FROM user WHERE id = ?').run(userId);
	});
}

// Sign-in throttling: after MAX_FAILURES wrong passwords for one email within
// FAILURE_WINDOW, that email is refused until the window passes. Per email
// rather than per address, so it holds behind a proxy; the cost is that a
// stranger can hold one email's sign-in shut for a while (sessions already
// signed in keep working). Kept in memory: a restart forgets it.
const MAX_FAILURES = 10;
const FAILURE_WINDOW = 15 * 60_000;
const failures = new Map<string, { count: number; since: number }>();

function failureEntry(email: string, now: number) {
	const key = normalizeEmail(email);
	const entry = failures.get(key);
	if (entry && now - entry.since > FAILURE_WINDOW) {
		failures.delete(key);
		return { key, entry: undefined };
	}
	return { key, entry };
}

/** Whether sign-in for this email is refused for now. */
export function signInThrottled(email: string, now = Date.now()): boolean {
	return (failureEntry(email, now).entry?.count ?? 0) >= MAX_FAILURES;
}

/** Counts a failed sign-in, or (`ok`) forgets the email's failures. */
export function noteSignIn(email: string, ok: boolean, now = Date.now()): void {
	const { key, entry } = failureEntry(email, now);
	if (ok) {
		failures.delete(key);
		return;
	}
	if (entry) entry.count++;
	else {
		// Bounded: past this many distinct emails, the oldest are dropped.
		if (failures.size >= 10_000) failures.delete(failures.keys().next().value!);
		failures.set(key, { count: 1, since: now });
	}
}

function tokenId(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

/** Starts a session; returns the cookie token and when it expires. */
export function createSession(db: Db, userId: number): { token: string; expires: Date } {
	const token = randomBytes(32).toString('base64url');
	const expires = Date.now() + SESSION_MS;
	db.prepare('INSERT INTO session (id, user_id, expires_at) VALUES (?, ?, ?)').run(
		tokenId(token),
		userId,
		expires
	);
	db.prepare('DELETE FROM session WHERE expires_at < ?').run(Date.now());
	return { token, expires: new Date(expires) };
}

/** The session's user, and a new expiry when the session was extended. */
export function sessionUser(db: Db, token: string): { user: User; renewed?: Date } | null {
	const id = tokenId(token);
	const row = db
		.prepare(
			`SELECT session.expires_at, ${USER_COLUMNS.split(', ')
				.map((column) => `user.${column}`)
				.join(', ')}
			FROM session JOIN user ON user.id = session.user_id WHERE session.id = ?`
		)
		.get(id) as (User & { expires_at: number }) | undefined;
	if (!row) return null;
	const now = Date.now();
	if (row.expires_at < now) {
		db.prepare('DELETE FROM session WHERE id = ?').run(id);
		return null;
	}
	const { expires_at, ...user } = row;
	if (expires_at - now < SESSION_MS / 2) {
		const renewed = now + SESSION_MS;
		db.prepare('UPDATE session SET expires_at = ? WHERE id = ?').run(renewed, id);
		return { user, renewed: new Date(renewed) };
	}
	return { user };
}

export function deleteSession(db: Db, token: string): void {
	db.prepare('DELETE FROM session WHERE id = ?').run(tokenId(token));
}
