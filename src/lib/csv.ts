// RFC 4180 CSV: quoted fields may hold commas, quotes ("") and line breaks.

export class CsvError extends Error {}

export function parseCsv(text: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let field = '';
	let quoted = false;
	let i = text.charCodeAt(0) === 0xfeff ? 1 : 0;
	let line = 1;
	for (; i < text.length; i++) {
		const char = text[i];
		if (quoted) {
			if (char === '"') {
				if (text[i + 1] === '"') {
					field += '"';
					i++;
				} else quoted = false;
			} else {
				if (char === '\n') line++;
				field += char;
			}
		} else if (char === '"' && field === '') {
			quoted = true;
		} else if (char === ',') {
			row.push(field);
			field = '';
		} else if (char === '\n' || char === '\r') {
			if (char === '\r' && text[i + 1] === '\n') i++;
			row.push(field);
			rows.push(row);
			row = [];
			field = '';
			line++;
		} else {
			field += char;
		}
	}
	if (quoted) throw new CsvError(`line ${line}: unclosed quote`);
	if (field !== '' || row.length > 0) {
		row.push(field);
		rows.push(row);
	}
	// Blank lines carry no record.
	return rows.filter((cells) => cells.length > 1 || cells[0] !== '');
}

/** Rows as objects keyed by the (trimmed) header row. Each has its line number. */
export function parseCsvRecords(text: string): { line: number; record: Record<string, string> }[] {
	const [header, ...rows] = parseCsv(text);
	if (!header) return [];
	const names = header.map((name) => name.trim());
	return rows.map((cells, index) => {
		if (cells.length !== names.length) {
			throw new CsvError(
				`row ${index + 1}: expected ${names.length} fields, found ${cells.length}`
			);
		}
		return {
			line: index + 2,
			record: Object.fromEntries(names.map((name, column) => [name, cells[column]]))
		};
	});
}
