// A minimal zip writer: files stored uncompressed (Markdown is small), UTF-8
// names, one archive in memory. Enough for an export; nothing reads zips here.

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
	let c = n;
	for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
	return c >>> 0;
});

export function crc32(bytes: Uint8Array): number {
	let crc = 0xffffffff;
	for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
	return (crc ^ 0xffffffff) >>> 0;
}

/** MS-DOS time and date, as zip headers keep them (local time, 2-second steps). */
function dosTime(date: Date): [number, number] {
	const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
	const day =
		(Math.max(0, date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
	return [time, day];
}

export interface ZipFile {
	/** Path inside the archive, `/`-separated. */
	path: string;
	text: string;
}

export function zip(files: ZipFile[], date = new Date()): Blob {
	const utf8 = new TextEncoder();
	const [time, day] = dosTime(date);
	const parts: Uint8Array<ArrayBuffer>[] = [];
	const central: Uint8Array<ArrayBuffer>[] = [];
	let offset = 0;
	for (const file of files) {
		const name = utf8.encode(file.path);
		const data = utf8.encode(file.text);
		const crc = crc32(data);
		// Bit 11: names are UTF-8.
		const common = (view: DataView, at: number) => {
			view.setUint16(at, 20, true); // version needed
			view.setUint16(at + 2, 0x0800, true);
			view.setUint16(at + 4, 0, true); // stored
			view.setUint16(at + 6, time, true);
			view.setUint16(at + 8, day, true);
			view.setUint32(at + 10, crc, true);
			view.setUint32(at + 14, data.length, true);
			view.setUint32(at + 18, data.length, true);
			view.setUint16(at + 22, name.length, true);
			view.setUint16(at + 24, 0, true); // extra field
		};
		const local = new Uint8Array(30 + name.length);
		const lv = new DataView(local.buffer);
		lv.setUint32(0, 0x04034b50, true);
		common(lv, 4);
		local.set(name, 30);
		parts.push(local, data);

		const entry = new Uint8Array(46 + name.length);
		const cv = new DataView(entry.buffer);
		cv.setUint32(0, 0x02014b50, true);
		cv.setUint16(4, 20, true); // version made by
		common(cv, 6);
		// comment length, disk, internal and external attributes: 0
		cv.setUint32(42, offset, true);
		entry.set(name, 46);
		central.push(entry);
		offset += local.length + data.length;
	}
	const size = central.reduce((sum, entry) => sum + entry.length, 0);
	const end = new Uint8Array(22);
	const ev = new DataView(end.buffer);
	ev.setUint32(0, 0x06054b50, true);
	ev.setUint16(8, files.length, true);
	ev.setUint16(10, files.length, true);
	ev.setUint32(12, size, true);
	ev.setUint32(16, offset, true);
	return new Blob([...parts, ...central, end], { type: 'application/zip' });
}
