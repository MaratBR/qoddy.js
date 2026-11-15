<script lang="ts">
	// A thought set as the page: optional date line (with the collection it comes
	// from, when it is someone else's), the text, its attribution, and the notes
	// behind a disclosure. Applies the thought's own look.
	import type { Snippet } from 'svelte';
	import { renderMarkdown } from '#lib/markdown.ts';
	import { sizeClass, type ThoughtFields } from '#lib/thought.ts';
	import { useLook } from '#lib/client/look.svelte.ts';
	import { t } from '#lib/client/i18n.svelte.ts';
	import Icon from './Icon.svelte';

	let {
		thought,
		dateline,
		source,
		actions
	}: {
		thought: ThoughtFields & { id: string };
		dateline?: string;
		source?: string;
		actions?: Snippet;
	} = $props();

	let open = $state(false);
	useLook(() => thought);

	// Quotation marks for attributed thoughts; your own unattributed ones stand bare.
	const quoted = $derived(Boolean(thought.author));
	const notes = $derived(thought.notes ? renderMarkdown(thought.notes) : null);

	// The page is the thought: a long one on a small window is set smaller
	// (down to FLOOR of its size) rather than scroll. Open notes may scroll.
	const FLOOR = 0.55;
	let article: HTMLElement | undefined = $state();

	function fit() {
		if (!article || open) return;
		const root = document.documentElement;
		const body = document.body;
		// The body is at least the window tall (base.css); taller, and the page scrolls.
		// Exact heights, as scrollHeight rounds a fraction of a pixel away; the
		// computed min-height is itself rounded to thousandths.
		const viewport = parseFloat(getComputedStyle(body).minHeight) + 0.01;
		const fits = (scale: number) => {
			article!.style.setProperty('--fit', String(scale));
			return body.getBoundingClientRect().height <= viewport;
		};
		// Measure without a scrollbar: where one takes width, it would add lines.
		root.style.overflow = 'hidden';
		try {
			if (fits(1)) return;
			// Smaller cannot help when even the floor scrolls: keep the full size.
			if (!fits(FLOOR)) return void fits(1);
			let [low, high] = [FLOOR, 1];
			for (let step = 0; step < 7; step++) {
				const mid = (low + high) / 2;
				if (fits(mid)) low = mid;
				else high = mid;
			}
			fits(low);
		} finally {
			root.style.overflow = '';
		}
	}

	$effect(() => {
		void [thought.text, thought.author, thought.source, dateline, source];
		fit();
	});
	$effect(() => {
		document.fonts.addEventListener('loadingdone', fit);
		return () => document.fonts.removeEventListener('loadingdone', fit);
	});
</script>

<svelte:window onresize={fit} />

<article bind:this={article}>
	{#if dateline || source}
		<p class="dateline">
			{#if source}<span class="source">{source}</span>{/if}
			{#if dateline}<span>{dateline}</span>{/if}
		</p>
	{/if}
	{#key thought.id}
		<blockquote
			lang={thought.lang}
			dir="auto"
			class={['thought-type', sizeClass(thought.text)]}
			class:quoted
		>
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
			<button
				class="icon"
				aria-expanded={open}
				aria-label={t.thought.about}
				title={open ? t.thought.hideNotes : t.thought.about}
				onclick={() => (open = !open)}><Icon name="notes" /></button
			>
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
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem 0.75rem;
		font-style: var(--date-style);
		color: var(--muted);
		font-size: 1.15rem;
		margin-bottom: clamp(1.5rem, 5vh, 3rem);
	}
	/* Whose thoughts these are, set apart from the date. */
	.source {
		font-style: normal;
		font-size: 0.8rem;
		font-weight: 600;
		letter-spacing: 0.03em;
		color: var(--ink);
		border: 1px solid var(--rule);
		border-radius: 999px;
		padding: 0.15em 0.75em;
	}
	blockquote {
		margin: 0;
		quotes: auto;
		animation: arrive 0.9s cubic-bezier(0.2, 0.6, 0.2, 1) both;
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
		gap: 0.25rem;
		margin-top: 1rem;
		/* The first glyph lines up with the text, not its tap target. */
		margin-inline-start: -0.7rem;
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
		.dateline {
			margin-bottom: 1.25rem;
		}
		/* The opening mark hangs into the page margin (1.25rem); the text keeps the width. */
		.quoted p::before {
			padding-inline-end: 0.02em;
		}
	}
</style>
