<script lang="ts">
	// A thought set as the page: optional date line, the text, its attribution,
	// and the notes behind a disclosure. Applies the thought's own look.
	import type { Snippet } from 'svelte';
	import { renderMarkdown } from '#lib/markdown.ts';
	import { sizeClass, type ThoughtFields } from '#lib/thought.ts';
	import { useLook } from '#lib/client/look.svelte.ts';
	import { t } from '#lib/client/i18n.svelte.ts';

	let {
		thought,
		dateline,
		actions
	}: { thought: ThoughtFields & { id: string }; dateline?: string; actions?: Snippet } = $props();

	let open = $state(false);
	useLook(() => thought);

	// Quotation marks for attributed thoughts; your own unattributed ones stand bare.
	const quoted = $derived(Boolean(thought.author));
	const notes = $derived(thought.notes ? renderMarkdown(thought.notes) : null);
</script>

<article>
	{#if dateline}<p class="dateline">{dateline}</p>{/if}
	{#key thought.id}
		<blockquote lang={thought.lang} dir="auto" class={sizeClass(thought.text)} class:quoted>
			<p>{thought.text}</p>
		</blockquote>
	{/key}
	{#if thought.author || thought.source}
		<p class="attribution" lang={thought.lang} dir="auto">
			{thought.author ?? ''}{thought.author && thought.source ? ', ' : ''}{#if thought.source}<cite
					>{thought.source}</cite
				>{/if}
		</p>
	{/if}

	<div class="actions">
		{#if notes}
			<button class="link" aria-expanded={open} onclick={() => (open = !open)}>
				{open ? t.thought.hideNotes : t.thought.about}
			</button>
		{/if}
		{@render actions?.()}
	</div>

	{#if notes && open}
		<!-- renderMarkdown escapes all input before adding its own markup. -->
		<div class="prose notes" lang={thought.lang}>{@html notes}</div>
	{/if}
</article>

<style>
	article {
		max-width: 64rem;
	}
	.dateline {
		font-style: var(--date-style);
		color: var(--muted);
		font-size: 1.15rem;
		margin-bottom: clamp(1.5rem, 5vh, 3rem);
	}
	blockquote {
		margin: 0;
		font-family: var(--thought-font, var(--font));
		font-weight: var(--thought-weight);
		font-style: var(--thought-style);
		letter-spacing: var(--thought-tracking);
		line-height: var(--thought-leading);
		font-size: clamp(2rem, 1.2rem + 3.6vw, 4.25rem);
		max-width: 16em;
		quotes: auto;
		animation: arrive 0.9s cubic-bezier(0.2, 0.6, 0.2, 1) both;
	}
	blockquote.short {
		font-size: clamp(2.5rem, 1.2rem + 5.4vw, 6rem);
		max-width: 12em;
	}
	blockquote.long {
		font-size: clamp(1.45rem, 1rem + 1.7vw, 2.4rem);
		max-width: 24em;
		line-height: calc(var(--thought-leading) + 0.12);
	}
	blockquote p {
		margin: 0;
		text-wrap: balance;
		white-space: pre-line;
		position: relative;
	}
	/* The opening mark hangs in the margin so the text keeps its left edge. */
	.quoted p::before {
		content: open-quote;
		position: absolute;
		/* Before the text's start edge, in either direction. */
		inset-inline-end: 100%;
		padding-inline-end: 0.06em;
		color: var(--accent);
	}
	.quoted p::after {
		content: close-quote;
	}
	@keyframes arrive {
		from {
			opacity: 0;
			transform: translateY(0.4rem);
			filter: blur(3px);
		}
	}
	.attribution {
		margin: clamp(1.25rem, 3vh, 2rem) 0 0;
		font-size: 1.15rem;
	}
	.attribution::before {
		content: '— ';
		color: var(--muted);
	}
	cite {
		font-style: italic;
		color: var(--muted);
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem 1.5rem;
		margin-top: 1.25rem;
	}
	.notes {
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px solid var(--rule);
		animation: unfold 0.25s ease-out;
	}
	@keyframes unfold {
		from {
			opacity: 0;
			transform: translateY(-0.25rem);
		}
	}
	@media (max-width: 40rem) {
		/* Narrow screens: keep the hanging mark on screen. */
		blockquote {
			padding-inline-start: 0.45em;
		}
	}
</style>
