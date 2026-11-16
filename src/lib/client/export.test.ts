import { describe, expect, it } from 'vitest';
import { crc32 as nodeCrc32 } from 'node:zlib';
import { exportArchive, fileName, thoughtMarkdown, type ExportedThought } from './export.ts';
import { crc32 } from './zip.ts';

const thought = (fields: Partial<ExportedThought> = {}): ExportedThought => ({
	id: 'abc234def5',
	text: 'Не то, что «вы» думаете:\nвторая строка',
	author: 'Сенека',
	source: null,
	notes: '**Bold** notes',
	lang: 'ru',
	theme: null,
	color: '#6b4fa8',
	font: null,
	created: Date.UTC(2026, 0, 2),
	updatedAt: Date.UTC(2026, 0, 3),
	from: null,
	...fields
});

/** Reads a stored zip back: its names and texts, checking every CRC. */
async function unzip(blob: Blob): Promise<Map<string, string>> {
	const bytes = new Uint8Array(await blob.arrayBuffer());
	const view = new DataView(bytes.buffer);
	const end = bytes.length - 22;
	expect(view.getUint32(end, true)).toBe(0x06054b50);
	const count = view.getUint16(end + 10, true);
	let at = view.getUint32(end + 16, true);
	const files = new Map<string, string>();
	for (let index = 0; index < count; index++) {
		expect(view.getUint32(at, true)).toBe(0x02014b50);
		const crc = view.getUint32(at + 16, true);
		const size = view.getUint32(at + 24, true);
		const nameLength = view.getUint16(at + 28, true);
		const local = view.getUint32(at + 42, true);
		const name = new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLength));
		const start = local + 30 + view.getUint16(local + 26, true);
		const data = bytes.subarray(start, start + size);
		expect(nodeCrc32(data)).toBe(crc);
		files.set(name, new TextDecoder().decode(data));
		at += 46 + nameLength;
	}
	return files;
}

describe('export', () => {
	it('computes standard CRC-32', () => {
		const data = new TextEncoder().encode('The quick brown fox');
		expect(crc32(data)).toBe(nodeCrc32(data));
	});

	it('writes front matter, text and notes', () => {
		const markdown = thoughtMarkdown(thought());
		expect(markdown).toContain('author: "Сенека"');
		expect(markdown).toContain('created: "2026-01-02T00:00:00.000Z"');
		expect(markdown).not.toContain('source:');
		expect(markdown).toContain('\nНе то, что «вы» думаете:\nвторая строка\n');
		expect(markdown.endsWith('---\n\n**Bold** notes\n')).toBe(true);
		expect(fileName(thought())).toBe('не-то-что-вы-думаете-вторая-abc234def5.md');
		expect(fileName(thought({ text: '…' }))).toBe('abc234def5.md');
	});

	it('zips synced and device-only thoughts apart, readable by a standard reader', async () => {
		const files = await unzip(
			exportArchive([
				{ thought: thought(), synced: true },
				{ thought: thought({ id: 'zzz234def5', text: 'Mine', notes: null }), synced: false }
			])
		);
		expect([...files.keys()]).toEqual([
			'synced/не-то-что-вы-думаете-вторая-abc234def5.md',
			'this-device/mine-zzz234def5.md'
		]);
		expect(files.get('this-device/mine-zzz234def5.md')).toContain('\nMine\n');
	});
});
