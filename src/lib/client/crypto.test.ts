import { describe, expect, it } from 'vitest';
import { createLock, decryptItem, encryptItem, openLock } from './crypto.ts';

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
