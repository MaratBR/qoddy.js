<script lang="ts">
	// A thought set as the page: optional date line (with the collection it comes
	// from, when it is someone else's), the text and its attribution. Applies the
	// thought's own look. The page shows its notes (Notes.svelte) below, and
	// `onnotes` takes the reader there.
	import type { Snippet } from 'svelte';
	import { sizeClass, type ThoughtFields } from '#lib/thought.ts';
	import { useLook } from '#lib/client/look.svelte.ts';
	import { t } from '#lib/client/i18n.svelte.ts';
	import { library } from '#lib/client/library.svelte.ts';
	import Icon from './Icon.svelte';

	let {
		thought,
		dateline,
		source,
		actions,
		onnotes
	}: {
		thought: ThoughtFields & { id: string };
		dateline?: string;
		source?: string;
		actions?: Snippet;
		onnotes?: () => void;
	} = $props();

	// Unless this device sets every thought in the reader's own theme.
	useLook(() => (library.plainLooks ? null : thought));

	// Quotation marks for attributed thoughts; your own unattributed ones stand bare.
	const quoted = $derived(Boolean(thought.author));

	// The page is the thought: a long one on a small window is set smaller
	// (down to FLOOR of its size) rather than outgrow the page's first screen.
	const FLOOR = 0.55;
	let article: HTMLElement | undefined = $state();

	function fit() {
		const screen = article?.closest<HTMLElement>('.screen');
		if (!article || !screen) return;
		const root = document.documentElement;
		// The screen is at least the window below the bar tall (base.css); taller,
		// and the thought does not fit. Exact heights, as scrollHeight rounds a
		// fraction of a pixel away; the computed min-height is itself rounded.
		const limit = parseFloat(getComputedStyle(screen).minHeight) + 0.01;
		const fits = (scale: number) => {
			article!.style.setProperty('--fit', String(scale));
			return screen.getBoundingClientRect().height <= limit;
		};
		// Measure without a scrollbar where one takes width (it would add lines),
		// unless the page goes on below the screen and scrolls anyway.
		const scrolls =
			document.body.getBoundingClientRect().bottom - screen.getBoundingClientRect().bottom > 1;
		if (!scrolls) root.style.overflow = 'hidden';
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
		void [thought.text, thought.author, thought.source, thought.notes, dateline, source];
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

	{#if actions || (thought.notes && onnotes)}
		<div class="actions">
			{@render actions?.()}
			{#if thought.notes && onnotes}
				<button
					class="icon down"
					onclick={onnotes}
					aria-label={t.thought.about}
					title={t.thought.about}><Icon name="down" /></button
				>
			{/if}
		</div>
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
		font-family: var(--ui-font);
		font-style: normal;
		font-size: 0.72rem;
		font-weight: 600;
		letter-spacing: 0.01em;
		color: var(--ink);
		background: color-mix(in oklab, var(--ink) 7%, transparent);
		border-radius: 999px;
		padding: 0.3em 0.85em;
	}
	blockquote {
		margin: 0;
		quotes: auto;
		animation: arrive 0.9s var(--ease) both;
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
		gap: 0.5rem;
		margin-top: 1.25rem;
	}
	/* On touch, the notes are a scroll away (Notes.svelte hints at them). */
	@media (any-pointer: coarse) {
		button.down {
			display: none;
		}
	}
	@media (max-width: 40rem) {
		/* Centered, so the thought keeps even room from both edges of a narrow screen. */
		article {
			text-align: center;
		}
		.dateline {
			justify-content: center;
			margin-bottom: 1.25rem;
		}
		.actions {
			justify-content: center;
		}
		/* Centered lines have no edge to hang from: the opening mark sits in the line. */
		.quoted p::before {
			position: static;
			padding-inline-end: 0.02em;
		}
		.attribution {
			text-wrap: balance;
		}
	}
</style>
