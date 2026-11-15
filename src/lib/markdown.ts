// A small Markdown renderer for a thought's notes: simple markup only.
//
// Blocks: paragraphs (single line breaks kept), `#`–`###` headings, `>` quotes,
// `-`/`*` and `1.` lists, and `---` rules. Inline: **strong**, *em* or _em_,
// `code`, and [links](https://…) to http(s) and mailto only.
//
// Safe by construction: every character of input is HTML-escaped before any
// markup is added, and markup is only ever produced by this file. The output
// can go into `{@html}` even for text the server never saw (encrypted notes).

const ESCAPES: Record<string, string> = {
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;',
	'"': '&quot;',
	"'": '&#39;'
};

export function escapeHtml(text: string): string {
	return text.replace(/[&<>"']/g, (char) => ESCAPES[char]);
}

const SAFE_HREF = /^(?:https?:\/\/|mailto:)/i;

/** Links may go to http(s) and mailto only. */
export const safeHref = (href: string) => SAFE_HREF.test(href);

/** Formats one block's text. `\u0000n\u0000` marks a finished fragment. */
function inline(source: string): string {
	const held: string[] = [];
	const hold = (html: string) => `\u0000${held.push(html) - 1}\u0000`;

	let text = escapeHtml(source.replace(/\u0000/g, ''));
	// Backslash escapes: the character is taken literally (`>` is escaped by now).
	text = text.replace(/\\([\\`*_[\]()#+\-.!]|&gt;)/g, (_, char: string) => hold(char));
	text = text.replace(/`([^`\n]+)`/g, (_, code: string) => hold(`<code>${code}</code>`));
	text = text.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (match, label: string, href: string) =>
		SAFE_HREF.test(href)
			? hold(`<a href="${href}" rel="noopener noreferrer nofollow">${emphasis(label)}</a>`)
			: label
	);
	// Fragments can hold others (an escape in code, code in a link).
	const restore = (html: string): string =>
		html.replace(/\u0000(\d+)\u0000/g, (_, index: string) => restore(held[Number(index)]));
	return restore(emphasis(text));
}

function emphasis(text: string): string {
	return text
		.replace(/\*\*(?=\S)([^\n]*?\S)\*\*/g, '<strong>$1</strong>')
		.replace(/__(?=\S)([^\n]*?\S)__/g, '<strong>$1</strong>')
		.replace(/\*(?=\S)([^*\n]*?\S)\*/g, '<em>$1</em>')
		.replace(/(^|[^\p{L}\p{N}_])_(?=\S)([^_\n]*?\S)_(?![\p{L}\p{N}_])/gu, '$1<em>$2</em>');
}

const HEADING = /^(#{1,3})\s+(.*?)\s*#*\s*$/;
const RULE = /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/;
const QUOTE = /^\s{0,3}>\s?/;
const BULLET = /^\s{0,3}[-*+]\s+/;
const NUMBER = /^\s{0,3}(\d{1,9})[.)]\s+/;

function startsBlock(line: string): boolean {
	return (
		HEADING.test(line) ||
		RULE.test(line) ||
		QUOTE.test(line) ||
		BULLET.test(line) ||
		NUMBER.test(line)
	);
}

function blocks(lines: string[], depth: number): string {
	const out: string[] = [];
	let i = 0;
	while (i < lines.length) {
		const line = lines[i];
		if (line.trim() === '') {
			i++;
			continue;
		}
		const heading = HEADING.exec(line);
		if (heading) {
			// Notes sit under the thought, so their headings start at h3.
			const level = heading[1].length + 2;
			out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
			i++;
			continue;
		}
		if (RULE.test(line)) {
			out.push('<hr>');
			i++;
			continue;
		}
		if (QUOTE.test(line)) {
			const inner: string[] = [];
			while (i < lines.length && QUOTE.test(lines[i])) inner.push(lines[i++].replace(QUOTE, ''));
			out.push(
				depth < 3
					? `<blockquote>${blocks(inner, depth + 1)}</blockquote>`
					: `<blockquote><p>${inner.map(inline).join('<br>')}</p></blockquote>`
			);
			continue;
		}
		const ordered = NUMBER.exec(line);
		if (ordered || BULLET.test(line)) {
			const marker = ordered ? NUMBER : BULLET;
			const items: string[][] = [];
			while (i < lines.length && lines[i].trim() !== '') {
				if (marker.test(lines[i])) items.push([lines[i].replace(marker, '')]);
				else if (startsBlock(lines[i])) break;
				else items[items.length - 1].push(lines[i].trim());
				i++;
			}
			const body = items.map((item) => `<li>${item.map(inline).join('<br>')}</li>`).join('');
			const start = ordered && ordered[1] !== '1' ? ` start="${Number(ordered[1])}"` : '';
			out.push(ordered ? `<ol${start}>${body}</ol>` : `<ul>${body}</ul>`);
			continue;
		}
		const paragraph: string[] = [];
		while (i < lines.length && lines[i].trim() !== '' && !startsBlock(lines[i])) {
			paragraph.push(lines[i++].trim());
		}
		out.push(`<p>${paragraph.map(inline).join('<br>')}</p>`);
	}
	return out.join('\n');
}

export function renderMarkdown(source: string): string {
	return blocks(source.replace(/\r\n?/g, '\n').split('\n'), 0);
}

// --- Back to Markdown ---------------------------------------------------------
//
// The notes editor holds a document tree (ProseMirror JSON, loaded from
// renderMarkdown's HTML); `toMarkdown` writes it back in the grammar above, so
// readers see what was edited. Bold is written `__` and italic `*`: those nest
// either way round here, where `***` would not.

/** A node of an editor document, as far as notes use one. */
export interface DocNode {
	type: string;
	attrs?: Record<string, unknown>;
	content?: DocNode[];
	text?: string;
	marks?: DocMark[];
}
interface DocMark {
	type: string;
	attrs?: Record<string, unknown>;
}

export function toMarkdown(doc: DocNode): string {
	return blocksOf(doc.content ?? []);
}

function blocksOf(nodes: DocNode[]): string {
	return nodes
		.map(block)
		.filter((text) => text !== '')
		.join('\n\n');
}

function block(node: DocNode): string {
	const children = node.content ?? [];
	switch (node.type) {
		case 'heading': {
			// Notes headings are h3–h5, written `#`–`###`.
			const level = Math.min(Math.max(Number(node.attrs?.level) - 2, 1), 3);
			const text = lines(children).join(' ').trim();
			return text && `${'#'.repeat(level)} ${text}`;
		}
		case 'horizontalRule':
			return '---';
		case 'blockquote':
			return blocksOf(children)
				.split('\n')
				.map((line) => (line ? `> ${line}` : '>'))
				.join('\n');
		case 'bulletList':
		case 'orderedList': {
			const start = Number(node.attrs?.start) || 1;
			return children
				.map((item, index) => {
					const marker = node.type === 'orderedList' ? `${start + index}. ` : '- ';
					const inline = (item.content ?? []).flatMap((paragraph) => paragraph.content ?? []);
					return lines(inline)
						.map((line, at) => (at === 0 ? marker + line : `   ${line}`))
						.join('\n');
				})
				.join('\n');
		}
		default:
			return children.every((child) => child.type === 'text' || child.type === 'hardBreak')
				? lines(children).join('\n')
				: blocksOf(children);
	}
}

/** Inline content as lines: hard breaks split them, and marks close at each. */
function lines(inline: DocNode[]): string[] {
	const runs: DocNode[][] = [[]];
	for (const node of inline) {
		if (node.type === 'hardBreak') runs.push([]);
		else if (node.type === 'text') runs[runs.length - 1].push(node);
	}
	const out = runs.map((run) => lineStart(spans(run).trim()));
	while (out.length > 1 && out[out.length - 1] === '') out.pop();
	return out;
}

/** Text that would start a block (`# `, `> `, `- `, `1. `, `---`) is escaped. */
function lineStart(line: string): string {
	if (!startsBlock(line)) return line;
	return /^\d/.test(line) ? line.replace(/^(\d+)/, '$1\\') : `\\${line}`;
}

const WRAPPED = new Set(['link', 'bold', 'italic']);
const sameMark = (a: DocMark, b: DocMark) =>
	a.type === b.type && (a.type !== 'link' || a.attrs?.href === b.attrs?.href);

/** Text nodes with their marks; the mark that runs furthest goes outermost. */
function spans(nodes: DocNode[]): string {
	let out = '';
	let i = 0;
	while (i < nodes.length) {
		let outer: DocMark | undefined;
		let end = i + 1;
		for (const mark of nodes[i].marks ?? []) {
			if (!WRAPPED.has(mark.type)) continue;
			let j = i + 1;
			while (j < nodes.length && nodes[j].marks?.some((other) => sameMark(other, mark))) j++;
			if (!outer || j > end) [outer, end] = [mark, j];
		}
		if (!outer) {
			out += leaf(nodes[i++]);
			continue;
		}
		const mark = outer;
		const inner = nodes
			.slice(i, end)
			.map((node) => ({ ...node, marks: node.marks?.filter((other) => !sameMark(other, mark)) }));
		out += wrap(mark, spans(inner));
		i = end;
	}
	return out;
}

function leaf(node: DocNode): string {
	const text = node.text ?? '';
	// Backslash escapes apply inside code too, so its backslashes are doubled.
	if (node.marks?.some((mark) => mark.type === 'code') && /^[^`\n]+$/.test(text)) {
		return `\`${text.replace(/\\/g, '\\\\')}\``;
	}
	return text.replace(/[\\`*_[\]]/g, '\\$&');
}

/** Delimiters must touch the text, so spaces at either end go outside them. */
function wrap(mark: DocMark, inner: string): string {
	const [, lead, core, trail] = /^(\s*)([\s\S]*?)(\s*)$/.exec(inner)!;
	if (!core) return inner;
	if (mark.type === 'bold') return `${lead}__${core}__${trail}`;
	if (mark.type === 'italic') return `${lead}*${core}*${trail}`;
	const href = String(mark.attrs?.href ?? '');
	if (!SAFE_HREF.test(href)) return inner;
	const escaped = href
		.replace(/\s/g, encodeURIComponent)
		.replace(/\(/g, '%28')
		.replace(/\)/g, '%29');
	return `${lead}[${core}](${escaped})${trail}`;
}
