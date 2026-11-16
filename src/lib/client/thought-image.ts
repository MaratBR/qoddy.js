// A thought as a picture to share: drawn on the device, on a canvas, in the
// page's current look (the thought's own theme, color and font while it is on
// screen, or the reader's). Nothing goes to the server.

import { sizeClass, type ThoughtFields } from '../thought.ts';

const WIDTH = 1080;
const HEIGHT = 1350;
/** Room around the thought; the opening mark hangs into the side margin. */
const SIDE = 130;
const TOP = 150;
/** The site's name sits in the bottom margin, below the thought; without it
 * the margins match. */
const BOTTOM = 210;
const MAX_SIZE = 128;
const MIN_SIZE = 26;

type Thought = Pick<ThoughtFields, 'text' | 'author' | 'source' | 'lang'>;

interface Look {
	paper: string;
	ink: string;
	muted: string;
	accent: string;
	family: string;
	weight: string;
	style: string;
	/** Tracking in em. */
	tracking: number;
	leading: number;
	ui: string;
}

/** Reads the page's tokens as colors and fonts a canvas understands. */
function readLook(): Look {
	const probe = document.createElement('span');
	probe.setAttribute('aria-hidden', 'true');
	probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none';
	document.body.append(probe);
	try {
		const color = (token: string) => {
			probe.style.color = `var(${token})`;
			return getComputedStyle(probe).color;
		};
		const [paper, ink, muted, accent] = ['--paper', '--ink', '--muted', '--accent'].map(color);
		// The thought's face, as `.thought-type` sets it (base.css).
		probe.style.fontFamily = 'var(--thought-font, var(--font))';
		probe.style.fontWeight = 'var(--thought-weight)';
		probe.style.fontStyle = 'var(--thought-style)';
		const face = getComputedStyle(probe);
		const family = face.fontFamily;
		const weight = face.fontWeight;
		const style = face.fontStyle.startsWith('italic') ? 'italic' : 'normal';
		const root = getComputedStyle(document.documentElement);
		const number = (token: string, fallback: number) => {
			const value = parseFloat(root.getPropertyValue(token));
			return Number.isFinite(value) ? value : fallback;
		};
		probe.style.fontFamily = 'var(--ui-font)';
		const ui = getComputedStyle(probe).fontFamily || 'system-ui, sans-serif';
		return {
			paper,
			ink,
			muted,
			accent,
			family,
			weight,
			style,
			tracking: number('--thought-tracking', 0),
			leading: number('--thought-leading', 1.15),
			ui
		};
	} finally {
		probe.remove();
	}
}

const RTL_LANGS = /^(ar|arc|ckb|dv|fa|he|iw|ks|ku-Arab|ps|sd|ug|ur|yi)\b/i;
const RTL_LETTER =
	/[\p{Script=Hebrew}\p{Script=Arabic}\p{Script=Syriac}\p{Script=Thaana}\p{Script=Nko}]/u;

/** Right-to-left: by the thought's language, else by its first letter. */
function isRtl(text: string, lang: string | null): boolean {
	if (lang && RTL_LANGS.test(lang)) return true;
	const first = text.match(/\p{L}/u)?.[0];
	return first ? RTL_LETTER.test(first) : false;
}

/** The language's quotation marks, much as `quotes: auto` picks them. */
function quoteMarks(lang: string | null): [string, string] {
	const tag = (lang ?? '').toLowerCase();
	const primary = tag.split('-')[0];
	const guillemets = ['ru', 'uk', 'be', 'fr', 'es', 'it', 'pt', 'ca', 'el', 'ar', 'fa', 'nb', 'no'];
	if (guillemets.includes(primary)) return ['«', '»'];
	if (['de', 'cs', 'sk', 'bg', 'lt', 'et', 'is'].includes(primary)) return ['„', '“'];
	if (['pl', 'ro', 'hu', 'nl', 'he'].includes(primary)) return ['„', '”'];
	if (primary === 'ja' || /^zh-(hant|tw|hk|mo)/.test(tag)) return ['「', '」'];
	return ['“', '”'];
}

const IDEOGRAPHIC = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;

interface Piece {
	text: string;
	/** A canvas font shorthand. */
	font: string;
	color: string;
	/** Canvas `letterSpacing`, in px. */
	tracking: string;
}
type Token = Piece[];

/**
 * Splits styled runs into tokens a line may break between: after spaces, and
 * between words written without spaces (Chinese, Japanese, Thai). Punctuation
 * stays with the word before it, and an opening bracket with the word after.
 */
function tokenize(runs: Piece[], lang: string | null): Token[] {
	const segmenter = new Intl.Segmenter(lang ?? undefined, { granularity: 'word' });
	const characters = new Intl.Segmenter(lang ?? undefined, { granularity: 'grapheme' });
	/** Words, except that Chinese and Japanese lines may break between any two characters. */
	function* pieces(text: string) {
		for (const { segment, isWordLike } of segmenter.segment(text)) {
			if (isWordLike && IDEOGRAPHIC.test(segment)) {
				for (const { segment: character } of characters.segment(segment))
					yield { segment: character, word: true };
			} else yield { segment, word: Boolean(isWordLike) };
		}
	}
	const tokens: Token[] = [];
	let previous: { space: boolean; word: boolean; open: boolean } | null = null;
	for (const run of runs) {
		for (const { segment, word } of pieces(run.text)) {
			// A no-break space (after the dash) joins.
			const space = /^[^\S\u00a0]+$/u.test(segment);
			const open = /^\p{Ps}+$/u.test(segment);
			const fresh =
				!previous ||
				(!previous.open && (previous.space || (word && previous.word) || (open && !space)));
			if (fresh) tokens.push([]);
			const token = tokens[tokens.length - 1];
			const last = token[token.length - 1];
			if (
				last &&
				last.font === run.font &&
				last.color === run.color &&
				last.tracking === run.tracking
			)
				last.text += segment;
			else token.push({ ...run, text: segment });
			previous = { space, word, open };
		}
	}
	return tokens;
}

/** Splits a token too wide for any line into characters (graphemes). */
function graphemes(token: Token): Token[] {
	const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
	return token.flatMap((piece) =>
		Array.from(segmenter.segment(piece.text), ({ segment }) => [{ ...piece, text: segment }])
	);
}

type Measure = (piece: Piece) => number;

function width(line: Token, measure: Measure): number {
	let total = 0;
	line.forEach((piece, i) => {
		// Trailing spaces hang past the line's end.
		const text = i === line.length - 1 ? piece.text.trimEnd() : piece.text;
		total += measure({ ...piece, text });
	});
	return total;
}

/** Greedy lines no wider than `max`. */
function wrap(tokens: Token[], max: number, measure: Measure): Token[] {
	const lines: Token[] = [];
	let line: Token = [];
	const tokenWidth = (token: Token) => width(token, measure);
	for (const token of tokens) {
		if (line.length && width([...line, ...token], measure) > max) {
			lines.push(line);
			line = [];
		}
		if (!line.length && tokenWidth(token) > max) {
			for (const part of graphemes(token)) {
				if (line.length && width([...line, ...part], measure) > max) {
					lines.push(line);
					line = [];
				}
				line.push(...part);
			}
			continue;
		}
		line.push(...token);
	}
	if (line.length) lines.push(line);
	return lines;
}

/** As `text-wrap: balance`: the narrowest measure that keeps as few lines. */
function balance(tokens: Token[], max: number, measure: Measure): Token[] {
	const lines = wrap(tokens, max, measure);
	if (lines.length < 2) return lines;
	let [low, high] = [max / 2, max];
	for (let step = 0; step < 10; step++) {
		const mid = (low + high) / 2;
		if (wrap(tokens, mid, measure).length > lines.length) low = mid;
		else high = mid;
	}
	return wrap(tokens, high, measure);
}

/** Paragraphs as the page sets them (`white-space: pre-line`). */
function paragraphs(text: string): string[] {
	return text.split(/\r?\n/).map((line) => line.replace(/[ \t]+/g, ' ').trim());
}

interface Block {
	lines: Token[];
	lineHeight: number;
}

/** Wraps each paragraph's runs; an empty paragraph is a blank line. */
function layout(
	runs: Piece[][],
	lang: string | null,
	max: number,
	lineHeight: number,
	measure: Measure
): Block {
	const lines = runs.flatMap((paragraph) =>
		paragraph.some((run) => run.text) ? balance(tokenize(paragraph, lang), max, measure) : [[]]
	);
	return { lines, lineHeight };
}

const height = (block: Block | null) => (block ? block.lines.length * block.lineHeight : 0);

/** Draws a thought as a 1080×1350 PNG in the page's current look, signed with
 * the site's name unless it is null. */
export async function thoughtImage(
	thought: Thought,
	opts: { siteName: string | null }
): Promise<Blob> {
	const bottom = opts.siteName ? BOTTOM : TOP;
	const look = readLook();
	const rtl = isRtl(thought.text, thought.lang);
	const [open, close] = quoteMarks(thought.lang);
	const quoted = Boolean(thought.author);
	const text = quoted ? thought.text.trim() + close : thought.text.trim();
	const attribution = [thought.author, thought.source].filter(Boolean).join(', ');

	const font = (size: number) => `${look.style} ${look.weight} ${size}px ${look.family}`;
	const regular = (size: number) => `normal 400 ${size}px ${look.family}`;
	const italic = (size: number) => `italic 400 ${size}px ${look.family}`;
	const ui = `normal 500 28px ${look.ui}`;
	try {
		await Promise.all([
			document.fonts.load(font(64), text),
			attribution && document.fonts.load(regular(32), attribution),
			thought.source && document.fonts.load(italic(32), thought.source),
			opts.siteName && document.fonts.load(ui, opts.siteName)
		]);
	} catch {
		// Drawn in a fallback face rather than not at all.
	}

	const canvas = document.createElement('canvas');
	canvas.width = WIDTH;
	canvas.height = HEIGHT;
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('No canvas.');
	ctx.direction = rtl ? 'rtl' : 'ltr';
	// The language picks the glyphs, as `lang` does on the page (Chinese and
	// Japanese share code points); `lang` on the canvas is newer than the rest.
	if (thought.lang) {
		canvas.lang = thought.lang;
		if ('lang' in ctx) (ctx as { lang: string }).lang = thought.lang;
	}
	ctx.textBaseline = 'alphabetic';
	ctx.textAlign = rtl ? 'right' : 'left';
	const spacing = 'letterSpacing' in ctx;
	const measure: Measure = (piece) => {
		ctx.font = piece.font;
		if (spacing) ctx.letterSpacing = piece.tracking;
		return ctx.measureText(piece.text).width;
	};

	const inner = WIDTH - 2 * SIDE;
	const room = HEIGHT - TOP - bottom;
	// Long thoughts get the page's looser leading.
	const leading = look.leading + (sizeClass(thought.text) === 'long' ? 0.12 : 0);
	let size = MAX_SIZE;
	let small: number;
	let body: Block;
	let byline: Block | null;
	let gap: number;
	for (;;) {
		const tracking = `${(look.tracking * size).toFixed(2)}px`;
		body = layout(
			paragraphs(text).map((paragraph) => [
				{ text: paragraph, font: font(size), color: look.ink, tracking }
			]),
			thought.lang,
			inner,
			size * leading,
			measure
		);
		small = Math.round(Math.min(40, Math.max(28, size * 0.42)));
		gap = small * 1.4;
		const piece = (text: string, color: string, face = regular) => ({
			text,
			font: face(small),
			color,
			tracking: '0px'
		});
		byline = attribution
			? layout(
					[
						[
							piece('—\u00a0', look.muted),
							piece(thought.author ?? '', look.ink),
							piece(thought.author && thought.source ? ', ' : '', look.muted),
							piece(thought.source ?? '', look.muted, italic)
						].filter((run) => run.text)
					],
					thought.lang,
					inner,
					small * 1.35,
					measure
				)
			: null;
		const total = height(body) + (byline ? gap + height(byline) : 0);
		if (total <= room || size <= MIN_SIZE) break;
		size = Math.max(MIN_SIZE, Math.floor(size * 0.94));
	}

	ctx.fillStyle = look.paper;
	ctx.fillRect(0, 0, WIDTH, HEIGHT);

	const start = rtl ? WIDTH - SIDE : SIDE;
	const total = height(body) + (byline ? gap + height(byline) : 0);
	// A little above the middle, where the eye expects it.
	let top = TOP + Math.max(0, (room - total) * 0.42);

	const drawLine = (line: Token, y: number) => {
		let x = start;
		line.forEach((piece, i) => {
			const text = i === line.length - 1 ? piece.text.trimEnd() : piece.text;
			const w = measure({ ...piece, text });
			ctx.fillStyle = piece.color;
			ctx.fillText(text, x, y);
			x += rtl ? -w : w;
		});
	};
	const drawBlock = (block: Block, ascent: number) => {
		block.lines.forEach((line, i) => {
			if (line.length) drawLine(line, top + i * block.lineHeight + ascent);
		});
		top += height(block);
	};

	// The baseline sits where CSS puts it: half-leading above the ascent.
	const ascent = (lineHeight: number, px: number) => (lineHeight - px) / 2 + px * 0.8;
	const firstBaseline = top + ascent(body.lineHeight, size);
	drawBlock(body, ascent(body.lineHeight, size));
	if (quoted) {
		// The opening mark hangs before the text's start edge.
		ctx.font = font(size);
		if (spacing) ctx.letterSpacing = '0px';
		ctx.fillStyle = look.accent;
		const w = ctx.measureText(open).width + size * 0.06;
		ctx.fillText(open, rtl ? start + w : start - w, firstBaseline);
	}
	if (byline) {
		top += gap;
		drawBlock(byline, ascent(byline.lineHeight, small));
	}

	// The site's name, quietly, at the foot.
	if (opts.siteName) {
		ctx.font = ui;
		if (spacing) ctx.letterSpacing = '0px';
		ctx.fillStyle = look.muted;
		ctx.fillText(opts.siteName, start, HEIGHT - BOTTOM / 2 + 10);
	}

	return new Promise((resolve, reject) =>
		canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('No image.'))), 'image/png')
	);
}

/** A file name from the thought's first words, e.g. `be-here-now.png`. */
export function imageName(text: string): string {
	const words = text
		.normalize('NFKC')
		.toLowerCase()
		.split(/[^\p{L}\p{N}]+/u)
		.filter(Boolean);
	let name = '';
	for (const word of words) {
		if (name && name.length + word.length > 40) break;
		name = name ? `${name}-${word}` : word;
	}
	return `${Array.from(name).slice(0, 60).join('') || 'thought'}.png`;
}
