import { describe, expect, it } from 'vitest';
import { escapeHtml, renderMarkdown, toMarkdown, type DocNode } from './markdown.ts';
import { parseCsv, parseCsvRecords, CsvError } from './csv.ts';
import { addDays, dayNumber, dayOfYear, isDate, ofTheDay } from './days.ts';
import { checkThought, sizeClass } from './thought.ts';
import { findLocale, matchLocale } from './locales.ts';
import { ru } from './client/locales/ru.ts';
import { en } from './client/locales/en.ts';

describe('locales', () => {
	it('picks the first browser language the app speaks', () => {
		expect(matchLocale(['ru-RU', 'en-US'])).toBe('ru');
		expect(matchLocale(['de-DE', 'EN'])).toBe('en');
		expect(matchLocale(['de', 'fr'])).toBeUndefined();
		expect(findLocale('ru')).toBe('ru');
		expect(findLocale('ru-RU')).toBeUndefined();
	});

	it('words counts by each language’s plural rules', () => {
		expect([1, 2, 5, 11, 21, 22, 25].map(ru.collection.count)).toEqual([
			'одна мысль',
			'2 мысли',
			'5 мыслей',
			'11 мыслей',
			'21 мысль',
			'22 мысли',
			'25 мыслей'
		]);
		expect(ru.status.pending(1)).toBe('1 изменение ждёт синхронизации.');
		expect(en.status.pending(1)).toBe('1 change waiting to sync.');
		expect(en.collection.count(3)).toBe('all 3 thoughts');
	});
});

describe('markdown', () => {
	it('renders simple markup', () => {
		expect(renderMarkdown('Hello **bold** and *em* and _em_ and `x*y*`')).toBe(
			'<p>Hello <strong>bold</strong> and <em>em</em> and <em>em</em> and <code>x*y*</code></p>'
		);
		expect(renderMarkdown('# Head\n\nline one\nline two')).toBe(
			'<h3>Head</h3>\n<p>line one<br>line two</p>'
		);
		expect(renderMarkdown('- a\n- b\n  more\n\n3. c\n4. d')).toBe(
			'<ul><li>a</li><li>b<br>more</li></ul>\n<ol start="3"><li>c</li><li>d</li></ol>'
		);
		expect(renderMarkdown('> quoted\n> > deeper\n\n---')).toBe(
			'<blockquote><p>quoted</p>\n<blockquote><p>deeper</p></blockquote></blockquote>\n<hr>'
		);
	});

	it('keeps underscores inside words and links', () => {
		expect(renderMarkdown('snake_case_name')).toBe('<p>snake_case_name</p>');
		expect(renderMarkdown('[see *this*](https://example.com/a_b_c?x=1&y=2)')).toBe(
			'<p><a href="https://example.com/a_b_c?x=1&amp;y=2" rel="noopener noreferrer nofollow">see <em>this</em></a></p>'
		);
	});

	it('never lets markup or unsafe links through', () => {
		const html = renderMarkdown(
			'<script>alert(1)</script> <img src=x onerror=alert(1)>\n[x](javascript:alert(1)) [y](https://a.com/"onmouseover="alert(1))'
		);
		expect(html).not.toMatch(/<script|<img|href="javascript|"onmouseover/);
		expect(html).toContain('&lt;script&gt;');
		expect(renderMarkdown('\\*not em\\*')).toBe('<p>*not em*</p>');
		expect(renderMarkdown('a\u0000b')).toBe('<p>ab</p>');
	});

	it('restores escapes inside code and code inside links', () => {
		expect(renderMarkdown('\\> not quoted')).toBe('<p>&gt; not quoted</p>');
		expect(renderMarkdown('`a\\\\b` [`c`](https://d.com)')).toBe(
			'<p><code>a\\b</code> <a href="https://d.com" rel="noopener noreferrer nofollow"><code>c</code></a></p>'
		);
	});
});

describe('toMarkdown', () => {
	const text = (value: string, ...marks: string[]): DocNode => ({
		type: 'text',
		text: value,
		marks: marks.map((type) =>
			type.includes(':') ? { type: 'link', attrs: { href: type } } : { type }
		)
	});
	const doc = (...content: DocNode[]): DocNode => ({ type: 'doc', content });
	const p = (...content: DocNode[]): DocNode => ({ type: 'paragraph', content });
	const br: DocNode = { type: 'hardBreak' };
	/** What the reader sees for the Markdown the editor writes. */
	const shown = (node: DocNode) => renderMarkdown(toMarkdown(node));

	it('writes every block the renderer knows', () => {
		const item = (...content: DocNode[]) => ({ type: 'listItem', content: [p(...content)] });
		const markdown = toMarkdown(
			doc(
				{ type: 'heading', attrs: { level: 3 }, content: [text('Head')] },
				p(text('one'), br, text('two')),
				{ type: 'bulletList', content: [item(text('a')), item(text('b'), br, text('more'))] },
				{ type: 'orderedList', attrs: { start: 3 }, content: [item(text('c')), item(text('d'))] },
				{
					type: 'blockquote',
					content: [p(text('quoted')), { type: 'blockquote', content: [p(text('deeper'))] }]
				},
				{ type: 'horizontalRule' }
			)
		);
		expect(markdown).toBe(
			'# Head\n\none\ntwo\n\n- a\n- b\n   more\n\n3. c\n4. d\n\n> quoted\n>\n> > deeper\n\n---'
		);
		expect(renderMarkdown(markdown)).toBe(
			'<h3>Head</h3>\n<p>one<br>two</p>\n<ul><li>a</li><li>b<br>more</li></ul>\n<ol start="3"><li>c</li><li>d</li></ol>\n<blockquote><p>quoted</p>\n<blockquote><p>deeper</p></blockquote></blockquote>\n<hr>'
		);
	});

	it('nests and splits marks the renderer can read', () => {
		expect(
			shown(doc(p(text('a ', 'bold'), text('both', 'bold', 'italic'), text(' c', 'bold'))))
		).toBe('<p><strong>a <em>both</em> c</strong></p>');
		expect(shown(doc(p(text('all', 'bold', 'italic'))))).toBe(
			'<p><strong><em>all</em></strong></p>'
		);
		expect(shown(doc(p(text('in', 'italic'), text('word'))))).toBe('<p><em>in</em>word</p>');
		expect(shown(doc(p(text('bold ', 'bold'), text('end'))))).toBe(
			'<p><strong>bold</strong> end</p>'
		);
		expect(shown(doc(p(text('across', 'bold'), br, text('lines', 'bold'))))).toBe(
			'<p><strong>across</strong><br><strong>lines</strong></p>'
		);
		expect(
			shown(
				doc(p(text('see ', 'https://a.com/x (1)'), text('this', 'https://a.com/x (1)', 'italic')))
			)
		).toBe(
			'<p><a href="https://a.com/x%20%281%29" rel="noopener noreferrer nofollow">see <em>this</em></a></p>'
		);
		expect(shown(doc(p(text('a\\*b`', 'code'), text(' and '), text('c:\\x*', 'code'))))).toBe(
			'<p>a\\*b` and <code>c:\\x*</code></p>'
		);
	});

	it('keeps literal text literal', () => {
		for (const literal of [
			'# not a heading',
			'> not a quote',
			'- not a list',
			'1. not a list',
			'---',
			'*a* _b_ [c](https://d.com) \\e'
		]) {
			expect(shown(doc(p(text(literal))))).toBe(`<p>${escapeHtml(literal)}</p>`);
		}
		expect(shown(doc(p(text('one'), br, text('- two'))))).toBe('<p>one<br>- two</p>');
	});

	it('drops unsafe links and empty blocks', () => {
		expect(toMarkdown(doc(p(text('x', 'javascript:alert(1)'))))).toBe('x');
		expect(toMarkdown(doc(p(), p(text('a'), br), { type: 'heading', attrs: { level: 3 } }))).toBe(
			'a'
		);
	});
});

describe('csv', () => {
	it('parses quotes, commas and line breaks', () => {
		expect(parseCsv('a,b\n"x, ""y""","multi\nline"\r\n\n')).toEqual([
			['a', 'b'],
			['x, "y"', 'multi\nline']
		]);
		expect(parseCsvRecords('text , author\nHi,Me')).toEqual([
			{ line: 2, record: { text: 'Hi', author: 'Me' } }
		]);
	});

	it('rejects broken input', () => {
		expect(() => parseCsv('"open')).toThrow(CsvError);
		expect(() => parseCsvRecords('a,b\n1')).toThrow(/expected 2 fields/);
	});
});

describe('days', () => {
	it('counts calendar days', () => {
		expect(dayNumber('1970-01-02')).toBe(1);
		expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
		expect(addDays('2024-03-01', -1)).toBe('2024-02-29');
		expect(dayOfYear('2026-02-01')).toBe(32);
		expect(isDate('2026-02-30')).toBe(false);
		expect(isDate('2026-12-31')).toBe(true);
	});

	it('rotates through items one per day', () => {
		const items = ['a', 'b', 'c'];
		const first = ofTheDay(items, '2026-01-01');
		const next = ofTheDay(items, '2026-01-02');
		expect(items.indexOf(next!)).toBe((items.indexOf(first!) + 1) % 3);
		expect(ofTheDay(items, '2026-01-04')).toBe(first);
		expect(ofTheDay([], '2026-01-01')).toBeUndefined();
		expect(ofTheDay(items, '1960-01-01')).toBeDefined();
	});

	it('keeps earlier days when an item is added', () => {
		const joined: Record<string, string> = { a: '', b: '2026-01-01', c: '2026-01-01' };
		const since = (item: string) => joined[item] ?? '';
		const days = ['2026-01-05', '2026-01-06', '2026-01-07'];
		const before = days.map((day) => ofTheDay(['a', 'b', 'c'], day, since));
		joined.d = '2026-01-08';
		const after = days.map((day) => ofTheDay(['a', 'b', 'c', 'd'], day, since));
		expect(after).toEqual(before);
		expect(ofTheDay(['b'], '2025-12-31', since)).toBeUndefined();
	});
});

describe('thought', () => {
	it('validates and normalizes', () => {
		const checked = checkThought({ text: '  Know thyself. ', color: '#AABBCC', author: ' ' });
		expect(checked).toEqual({
			ok: true,
			value: {
				text: 'Know thyself.',
				author: null,
				source: null,
				notes: null,
				lang: null,
				theme: null,
				color: '#aabbcc',
				font: null
			}
		});
		expect(checkThought({ text: '' })).toMatchObject({
			ok: false,
			field: 'text',
			code: 'required'
		});
		expect(checkThought({ text: 'x', author: 'a'.repeat(201) })).toMatchObject({
			ok: false,
			field: 'author',
			code: 'too_long'
		});
		expect(checkThought({ text: 'x', theme: 'nope' })).toMatchObject({ ok: false, field: 'theme' });
		expect(checkThought({ text: 'x', font: 'A");}' })).toMatchObject({ ok: false, field: 'font' });
		expect(checkThought({ text: 'x', lang: 'zh-Hans' })).toMatchObject({ ok: true });
		expect(checkThought({ text: 'x', lang: 'e' })).toMatchObject({ ok: false, field: 'lang' });
	});

	it('sizes text by length', () => {
		expect(sizeClass('Short.')).toBe('short');
		expect(sizeClass('x'.repeat(300))).toBe('long');
		// 45 CJK characters count as 90: neither short nor long.
		expect(sizeClass('学'.repeat(45))).toBeUndefined();
	});
});
