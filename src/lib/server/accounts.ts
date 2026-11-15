// Accounts and sessions.
//
// Passwords: scrypt (N=2^15, r=8, p=1), stored as `scrypt$N$r$p$salt$hash`.
// Sessions: a random token in an HttpOnly cookie; the database keeps only its
// SHA-256, so a leaked database cannot be replayed as cookies. Sessions slide:
// one used in its second half is extended. Signing out deletes the row.

import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { Invalid, type Db } from './db.ts';
import { getSettings } from './settings.ts';
import { themeExists } from '../themes.ts';
import { findLocale } from '../locales.ts';
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

const USER_COLUMNS = 'id, email, name, role, theme, locale';

export function findUser(db: Db, id: number): User | undefined {
	return db.prepare(`SELECT ${USER_COLUMNS} FROM user WHERE id = ?`).get(id) as User | undefined;
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
	if (input.password.length > 1024) {
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
