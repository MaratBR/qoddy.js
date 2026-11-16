import { describe, expect, it } from 'vitest';
import {
	createAppLock,
	createLock,
	decryptItem,
	decryptText,
	encryptItem,
	encryptText,
	exportKey,
	importKey,
	openAppLock,
	openLock
} from './crypto.ts';

describe('lock', () => {
	it('opens with the right password only, and binds items to their ids', async () => {
		const { lock, key } = await createLock('correct horse');
		expect(lock.iterations).toBe(600_000);
		expect(await openLock(lock, 'wrong horse')).toBeNull();
		const reopened = (await openLock(lock, 'correct horse'))!;

		const envelope = await encryptItem(key, 'item1234', '{"text":"secret"}');
		expect(envelope).not.toContain('secret');
		expect(await decryptItem(reopened, 'item1234', envelope)).toBe('{"text":"secret"}');
		// Moved onto another item's id, it no longer decrypts.
		expect(await decryptItem(reopened, 'item9999', envelope)).toBeNull();
		expect(await decryptItem(reopened, 'item1234', 'garbage')).toBeNull();
	});
});

describe('app lock', () => {
	it('opens with the right passcode only, and keeps the data key when the passcode changes', async () => {
		const { lock, key } = await createAppLock('pin', '123456');
		expect(await openAppLock(lock, '654321')).toBeNull();
		const opened = (await openAppLock(lock, '123456'))!;
		const sealed = await encryptText(key, 'meta:state', 'hello');
		expect(await decryptText(opened, 'meta:state', sealed)).toBe('hello');
		expect(await decryptText(opened, 'meta:other', sealed)).toBeNull();

		const changed = await createAppLock('password', 'a long password', opened);
		expect(changed.lock.salt).not.toBe(lock.salt);
		const reopened = (await openAppLock(changed.lock, 'a long password'))!;
		expect(await decryptText(reopened, 'meta:state', sealed)).toBe('hello');
		expect(await openAppLock(changed.lock, '123456')).toBeNull();
	});

	it('exports derived keys so they can be stored under the app lock', async () => {
		const { key } = await createLock('correct horse');
		const raw = (await exportKey(key))!;
		const back = await importKey(raw);
		const envelope = await encryptItem(back, 'item1234', 'x');
		expect(await decryptItem(key, 'item1234', envelope)).toBe('x');
	});
});
