// Locking a personal collection with the account password, entirely in the browser.
//
// PBKDF2-SHA-256 (600k iterations) turns the password into an AES-GCM-256 key
// that never leaves the device (it is stored non-extractable). Each item is
// encrypted with a fresh 96-bit IV and its id as additional data, so the
// server cannot swap one item's ciphertext for another's. The lock's `check`
// tells a wrong password from a right one. Forgetting the password loses the
// thoughts: nothing on the server can recover them.

import { newId } from '../thought.ts';
import type { Lock } from '../wire.ts';

/** How this device's app lock opens: what is stored, never the key. */
export interface AppLock {
	kind: 'pin' | 'password';
	salt: string;
	iterations: number;
	/** The data key, encrypted with the passcode's key (`iv.data`). */
	key: string;
}

const ITERATIONS = 600_000;
const CHECK = 'qoddy-lock-check';
const utf8 = new TextEncoder();

function toBase64(bytes: Uint8Array): string {
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary);
}

function fromBase64(text: string): Uint8Array<ArrayBuffer> {
	return Uint8Array.from(atob(text), (char) => char.charCodeAt(0));
}

async function deriveKey(password: string, salt: string, iterations: number): Promise<CryptoKey> {
	const material = await crypto.subtle.importKey(
		'raw',
		utf8.encode(password.normalize('NFC')),
		'PBKDF2',
		false,
		['deriveKey']
	);
	return crypto.subtle.deriveKey(
		{ name: 'PBKDF2', hash: 'SHA-256', salt: fromBase64(salt), iterations },
		material,
		{ name: 'AES-GCM', length: 256 },
		true,
		['encrypt', 'decrypt']
	);
}

/** A key's raw bytes (base64), or null for a key that cannot be exported (stored by an older version). */
export async function exportKey(key: CryptoKey): Promise<string | null> {
	if (!key.extractable) return null;
	return toBase64(new Uint8Array(await crypto.subtle.exportKey('raw', key)));
}

export function importKey(raw: string): Promise<CryptoKey> {
	return crypto.subtle.importKey('raw', fromBase64(raw), 'AES-GCM', true, ['encrypt', 'decrypt']);
}

async function seal(key: CryptoKey, context: string, text: string) {
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const data = await crypto.subtle.encrypt(
		{ name: 'AES-GCM', iv, additionalData: utf8.encode(context) },
		key,
		utf8.encode(text)
	);
	return { iv: toBase64(iv), data: toBase64(new Uint8Array(data)) };
}

async function unseal(key: CryptoKey, context: string, iv: string, data: string) {
	try {
		const plain = await crypto.subtle.decrypt(
			{ name: 'AES-GCM', iv: fromBase64(iv), additionalData: utf8.encode(context) },
			key,
			fromBase64(data)
		);
		return new TextDecoder().decode(plain);
	} catch {
		return null;
	}
}

/** A new lock for `password`, and its key. */
export async function createLock(password: string): Promise<{ lock: Lock; key: CryptoKey }> {
	const salt = toBase64(crypto.getRandomValues(new Uint8Array(16)));
	const id = newId(12);
	const key = await deriveKey(password, salt, ITERATIONS);
	const check = await seal(key, `check:${id}`, CHECK);
	return { lock: { key: id, salt, iterations: ITERATIONS, check }, key };
}

/** The lock's key if `password` is right, else null. */
export async function openLock(lock: Lock, password: string): Promise<CryptoKey | null> {
	const key = await deriveKey(password, lock.salt, lock.iterations);
	const check = await unseal(key, `check:${lock.key}`, lock.check.iv, lock.check.data);
	return check === CHECK ? key : null;
}

/** Encrypts text as `iv.data` (base64), bound to `context`: it decrypts under that context only. */
export async function encryptText(key: CryptoKey, context: string, text: string): Promise<string> {
	const { iv, data } = await seal(key, context, text);
	return `${iv}.${data}`;
}

/** The text, or null if the key or the context is wrong or the envelope is damaged. */
export async function decryptText(key: CryptoKey, context: string, envelope: string) {
	const [iv, data] = envelope.split('.');
	return iv && data ? unseal(key, context, iv, data) : null;
}

/** Encrypts an item's JSON as `iv.data` (base64). */
export function encryptItem(key: CryptoKey, id: string, json: string): Promise<string> {
	return encryptText(key, `item:${id}`, json);
}

export function decryptItem(key: CryptoKey, id: string, envelope: string) {
	return decryptText(key, `item:${id}`, envelope);
}

/** Locks this device's data with a passcode or password: keeps `dataKey`, or makes one. */
export async function createAppLock(
	kind: AppLock['kind'],
	secret: string,
	dataKey?: CryptoKey
): Promise<{ lock: AppLock; key: CryptoKey }> {
	const key =
		dataKey ??
		(await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
			'encrypt',
			'decrypt'
		]));
	const raw = await exportKey(key);
	if (raw === null) throw new Error('The data key cannot be exported.');
	const salt = toBase64(crypto.getRandomValues(new Uint8Array(16)));
	const wrapping = await deriveKey(secret, salt, ITERATIONS);
	const wrapped = await encryptText(wrapping, 'app-lock', raw);
	return { lock: { kind, salt, iterations: ITERATIONS, key: wrapped }, key };
}

/** The data key if `secret` is right, else null. */
export async function openAppLock(lock: AppLock, secret: string): Promise<CryptoKey | null> {
	const wrapping = await deriveKey(secret, lock.salt, lock.iterations);
	const raw = await decryptText(wrapping, 'app-lock', lock.key);
	return raw === null ? null : importKey(raw);
}
