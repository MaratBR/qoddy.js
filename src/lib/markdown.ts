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

/** Formats one block's text. `\u0000n\u0000` marks a finished fragment. */
function inline(source: string): string {
	const held: string[] = [];
	const hold = (html: string) => `\u0000${held.push(html) - 1}\u0000`;

	let text = escapeHtml(source.replace(/\u0000/g, ''));
	// Backslash escapes: the character is taken literally.
	text = text.replace(/\\([\\`*_[\]()#+\-.!>])/g, (_, char: string) => hold(char));
	text = text.replace(/`([^`\n]+)`/g, (_, code: string) => hold(`<code>${code}</code>`));
	text = text.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (match, label: string, href: string) =>
		SAFE_HREF.test(href)
			? hold(`<a href="${href}" rel="noopener noreferrer nofollow">${emphasis(label)}</a>`)
			: label
	);
	text = emphasis(text);
	return text.replace(/\u0000(\d+)\u0000/g, (_, index: string) => held[Number(index)]);
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
