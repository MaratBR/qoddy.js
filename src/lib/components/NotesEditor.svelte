<script lang="ts">
	// A thought's notes, edited as they will read. The text stays the simple
	// Markdown of markdown.ts: it comes in through renderMarkdown and goes back
	// out through toMarkdown, and the editor allows only what those two know.
	// Untouched notes are never rewritten.
	import { onMount } from 'svelte';
	import { Editor, textblockTypeInputRule } from '@tiptap/core';
	import StarterKit from '@tiptap/starter-kit';
	import Heading from '@tiptap/extension-heading';
	import { ListItem } from '@tiptap/extension-list';
	import { Placeholder } from '@tiptap/extensions';
	import { renderMarkdown, safeHref, toMarkdown } from '#lib/markdown.ts';
	import { t } from '#lib/client/i18n.svelte.ts';
	import Icon, { type IconName } from './Icon.svelte';

	let { value = $bindable(''), label }: { value: string; label: string } = $props();

	let element: HTMLDivElement | undefined = $state();
	let editor: Editor | undefined = $state.raw();
	/** Bumped on every change, so the toolbar follows the selection. */
	let revision = $state(0);

	// Notes headings are h3–h5, typed `#`–`###` as in the Markdown.
	const NotesHeading = Heading.extend({
		addInputRules() {
			return [1, 2, 3].map((hashes) =>
				textblockTypeInputRule({
					find: new RegExp(`^#{${hashes}}\\s$`),
					type: this.type,
					getAttributes: { level: hashes + 2 }
				})
			);
		}
	}).configure({ levels: [3, 4, 5] });

	onMount(() => {
		editor = new Editor({
			element,
			extensions: [
				StarterKit.configure({
					codeBlock: false,
					strike: false,
					underline: false,
					heading: false,
					listItem: false,
					link: {
						openOnClick: false,
						defaultProtocol: 'https',
						isAllowedUri: (url) => safeHref(url),
						HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: null }
					}
				}),
				NotesHeading,
				// One paragraph per item: no nested lists.
				ListItem.extend({ content: 'paragraph' }),
				Placeholder.configure({ placeholder: () => t.write.notesPlaceholder })
			],
			content: value ? renderMarkdown(value) : '',
			editorProps: {
				attributes: { role: 'textbox', 'aria-multiline': 'true', 'aria-label': label }
			},
			onUpdate: ({ editor }) => {
				value = toMarkdown(editor.getJSON());
			},
			onTransaction: () => revision++
		});
		return () => editor?.destroy();
	});

	function link(editor: Editor) {
		const current = editor.getAttributes('link').href as string | undefined;
		const answer = prompt(t.write.format.linkPrompt, current ?? 'https://');
		if (answer === null) return;
		const chain = editor.chain().focus().extendMarkRange('link');
		const typed = answer.trim();
		if (!typed || typed === 'https://') return void chain.unsetLink().run();
		const href = /^[a-z][a-z\d+.-]*:/i.test(typed)
			? typed
			: typed.includes('@')
				? `mailto:${typed}`
				: `https://${typed}`;
		if (!safeHref(href)) return;
		if (editor.state.selection.empty && !current) {
			chain.insertContent({
				type: 'text',
				text: typed,
				marks: [{ type: 'link', attrs: { href } }]
			});
			return void chain.run();
		}
		chain.setLink({ href }).run();
	}

	const tools: {
		icon: IconName;
		label: () => string;
		active: (editor: Editor) => boolean;
		run: (editor: Editor) => void;
	}[] = [
		{
			icon: 'bold',
			label: () => t.write.format.bold,
			active: (e) => e.isActive('bold'),
			run: (e) => e.chain().focus().toggleBold().run()
		},
		{
			icon: 'italic',
			label: () => t.write.format.italic,
			active: (e) => e.isActive('italic'),
			run: (e) => e.chain().focus().toggleItalic().run()
		},
		{
			icon: 'link',
			label: () => t.write.format.link,
			active: (e) => e.isActive('link'),
			run: link
		},
		{
			icon: 'heading',
			label: () => t.write.format.heading,
			active: (e) => e.isActive('heading'),
			run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run()
		},
		{
			icon: 'list',
			label: () => t.write.format.list,
			active: (e) => e.isActive('bulletList'),
			run: (e) => e.chain().focus().toggleBulletList().run()
		},
		{
			icon: 'numbers',
			label: () => t.write.format.numbered,
			active: (e) => e.isActive('orderedList'),
			run: (e) => e.chain().focus().toggleOrderedList().run()
		},
		{
			icon: 'quote',
			label: () => t.write.format.quote,
			active: (e) => e.isActive('blockquote'),
			run: (e) => e.chain().focus().toggleBlockquote().run()
		}
	];

	const active = $derived.by(() => {
		void revision;
		return tools.map((tool) => (editor ? tool.active(editor) : false));
	});
</script>

<div class="notes-editor">
	<div class="toolbar" role="toolbar" aria-label={t.write.format.label}>
		{#each tools as tool, index (tool.icon)}
			<button
				type="button"
				class="icon"
				aria-pressed={active[index]}
				aria-label={tool.label()}
				title={tool.label()}
				disabled={!editor}
				onclick={() => editor && tool.run(editor)}><Icon name={tool.icon} /></button
			>
		{/each}
	</div>
	<div class="prose" bind:this={element}></div>
</div>

<style>
	.notes-editor {
		border-top: 1px solid var(--rule);
		transition: border-color 0.15s ease;
	}
	.notes-editor:focus-within {
		border-top-color: var(--accent);
	}
	/* The tools in one recessed track, as a segmented control; a style that is
	   on stands raised in it. */
	.toolbar {
		display: inline-flex;
		flex-wrap: wrap;
		gap: 2px;
		padding: 3px;
		border-radius: calc(var(--radius) + 5px);
		background: color-mix(in oklab, var(--ink) 6%, transparent);
	}
	.toolbar .icon {
		width: 2.25rem;
		height: 2.25rem;
		border-radius: calc(var(--radius) + 2px);
		background: none;
	}
	.toolbar .icon[aria-pressed='true'] {
		color: var(--accent);
		background: light-dark(
			color-mix(in oklab, var(--paper) 35%, #fff),
			color-mix(in oklab, var(--ink) 22%, var(--paper))
		);
		box-shadow:
			0 1px 2px color-mix(in oklab, #000 14%, transparent),
			0 2px 6px -2px color-mix(in oklab, #000 12%, transparent);
	}
	.toolbar .icon :global(svg) {
		width: 1.15rem;
		height: 1.15rem;
	}
	.prose :global(.ProseMirror) {
		min-height: 6rem;
		padding-bottom: 0.5rem;
	}
	/* The caret and the accent rule above show focus. */
	.prose :global(.ProseMirror:focus-visible) {
		outline: none;
	}
	.prose :global(.ProseMirror > :first-child) {
		margin-top: 0;
	}
	/* Items hold a paragraph here; read, they hold the text alone. */
	.prose :global(li > p) {
		margin: 0;
	}
	.prose :global(p.is-editor-empty:first-child::before) {
		content: attr(data-placeholder);
		float: inline-start;
		height: 0;
		color: var(--muted);
		pointer-events: none;
	}
</style>
