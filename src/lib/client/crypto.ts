// Locking a personal collection with a password, entirely in the browser.
//
// PBKDF2-SHA-256 (600k iterations) turns the password into an AES-GCM-256 key
// that never leaves the device (it is stored non-extractable). Each item is
// encrypted with a fresh 96-bit IV and its id as additional data, so the
// server cannot swap one item's ciphertext for another's. The lock's `check`
// tells a wrong password from a right one. Forgetting the password loses the
// thoughts: nothing on the server can recover them.

import { newId } from '../thought.ts';
import type { Lock } from '../wire.ts';

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
		false,
		['encrypt', 'decrypt']
	);
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

/** Encrypts an item's JSON as `iv.data` (base64). */
export async function encryptItem(key: CryptoKey, id: string, json: string): Promise<string> {
	const { iv, data } = await seal(key, `item:${id}`, json);
	return `${iv}.${data}`;
}

export async function decryptItem(key: CryptoKey, id: string, envelope: string) {
	const [iv, data] = envelope.split('.');
	return iv && data ? unseal(key, `item:${id}`, iv, data) : null;
}
