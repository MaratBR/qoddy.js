// A thought: the text, its attribution, optional Markdown notes that explain
// it, and how it is set. Shared by the server (admin edits, CSV import) and the
// client (personal thoughts, which the server cannot read when encrypted).

import { themeExists } from './themes.ts';

export interface ThoughtFields {
	text: string;
	author: string | null;
	source: string | null;
	/** Markdown (simple markup only, see `markdown.ts`). */
	notes: string | null;
	/** BCP 47 tag of `text`, e.g. `zh-Hans`. */
	lang: string | null;
	/** Theme id shown with this thought, overriding the reader's. */
	theme: string | null;
	/** `#rrggbb` the theme weaves into the page. */
	color: string | null;
	/** Google Fonts family for the text. */
	font: string | null;
}

export const LIMITS = { text: 2000, author: 200, source: 300, notes: 20000 } as const;

export type FieldName = keyof ThoughtFields;

export type Checked =
	{ ok: true; value: ThoughtFields } | { ok: false; field: FieldName; error: string };

function clean(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	return trimmed === '' ? null : trimmed;
}

/** `#rrggbb`, lowercased, or null if it is not one. */
export function normalizeColor(value: string): string | null {
	return /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : null;
}

/** Family names go into a Google Fonts URL and a CSS string, so keep them plain. */
export function validFont(value: string): boolean {
	return /^[A-Za-z0-9](?:[A-Za-z0-9 ]{0,62}[A-Za-z0-9])?$/.test(value);
}

/** A loose BCP 47 shape: `xx` or `xxx`, then `-subtag`s. */
export function validLang(value: string): boolean {
	return /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{1,8})*$/.test(value);
}

/** Validates and normalizes untrusted input. Unknown keys are ignored. */
export function checkThought(raw: object): Checked {
	const input = raw as Record<string, unknown>;
	const text = clean(input.text);
	if (!text) return { ok: false, field: 'text', error: 'Write the thought itself.' };
	const value: ThoughtFields = {
		text,
		author: clean(input.author),
		source: clean(input.source),
		notes: clean(input.notes),
		lang: clean(input.lang),
		theme: clean(input.theme),
		color: clean(input.color),
		font: clean(input.font)
	};
	for (const field of ['text', 'author', 'source', 'notes'] as const) {
		const length = value[field]?.length ?? 0;
		if (length > LIMITS[field]) {
			return { ok: false, field, error: `Keep it under ${LIMITS[field]} characters.` };
		}
	}
	if (value.lang && !validLang(value.lang)) {
		return { ok: false, field: 'lang', error: 'Use a language tag like en, ru or zh-Hans.' };
	}
	if (value.theme && !themeExists(value.theme)) {
		return { ok: false, field: 'theme', error: `There is no theme called “${value.theme}”.` };
	}
	if (value.color) {
		const color = normalizeColor(value.color);
		if (!color) return { ok: false, field: 'color', error: 'Use a color like #8a2c1d.' };
		value.color = color;
	}
	if (value.font && !validFont(value.font)) {
		return {
			ok: false,
			field: 'font',
			error: 'Use a Google Fonts family name (letters, digits and spaces).'
		};
	}
	return { ok: true, value };
}

/** Text up to this long (CJK counting double) is set larger; longer than `LONG`, smaller. */
const SHORT = 80;
const LONG = 220;

export function sizeClass(text: string): 'short' | 'long' | undefined {
	let length = 0;
	for (const char of text) length += char >= '⺀' ? 2 : 1;
	if (length <= SHORT) return 'short';
	if (length > LONG) return 'long';
	return undefined;
}

/** A random id for public permalinks and personal thoughts: no 0/O, 1/l/I. */
const ALPHABET = '23456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';

export function newId(length = 10): string {
	const bytes = crypto.getRandomValues(new Uint8Array(length));
	// 256 % 57 leaves a slight bias, harmless for ids that only need to be unguessable-ish.
	return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join('');
}

export function isId(value: string): boolean {
	return /^[A-Za-z0-9]{6,32}$/.test(value);
}
