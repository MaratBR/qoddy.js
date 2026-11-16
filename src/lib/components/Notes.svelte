<script lang="ts">
	// A thought's notes as a screen of their own, below the page's first screen
	// (`.screen`). On touch, scrolling down snaps to them and back up to the
	// thought; a muted chevron at the foot of the first screen says so. Without touch they wait hidden until `show()` (the thought's down
	// arrow), which glides to them.
	import { tick } from 'svelte';
	import { renderMarkdown } from '#lib/markdown.ts';
	import { t } from '#lib/client/i18n.svelte.ts';

	const SHORT = 280;

	let { notes, lang }: { notes: string; lang?: string | null } = $props();

	const html = $derived(renderMarkdown(notes));
	/** A few lines are set large, to fill their screen as the thought fills its own. */
	const short = $derived(notes.length <= SHORT);
	let shown = $state(false);
	let section: HTMLElement | undefined = $state();

	export async function show() {
		shown = true;
		await tick();
		const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
		section?.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' });
	}
</script>

<section bind:this={section} class="notes-screen" class:shown {lang} aria-labelledby="notes-label">
	<svg class="hint" viewBox="0 0 40 10" aria-hidden="true"><path d="M2 2.5 20 8 38 2.5" /></svg>
	<div class="notes" class:short>
		<h2 class="label" id="notes-label">{t.thought.about}</h2>
		<!-- renderMarkdown escapes all input before adding its own markup. -->
		<div class="prose">{@html html}</div>
	</div>
</section>

<style>
	/* On touch, a page with notes snaps: the thought, then the notes. */
	@media (any-pointer: coarse) {
		:global(html:has(.notes-screen)) {
			scroll-snap-type: y mandatory;
		}
	}
	@media not (any-pointer: coarse) {
		.notes-screen:not(.shown),
		.hint {
			display: none;
		}
	}
	/* Hangs from the notes into the very bottom of the screen above, clear of
	   the home indicator where there is one. */
	.hint {
		position: absolute;
		bottom: calc(100% + max(0.35rem, env(safe-area-inset-bottom) - 1rem));
		left: 50%;
		translate: -50% 0;
		width: 2.6rem;
		height: 0.65rem;
		fill: none;
		stroke: color-mix(in oklab, var(--muted) 60%, transparent);
		stroke-width: 1.6;
		stroke-linecap: round;
		stroke-linejoin: round;
		pointer-events: none;
	}
	.notes-screen {
		position: relative;
		min-height: calc(100dvh - var(--bar, 0px));
		scroll-snap-align: start;
		display: grid;
		align-content: safe center;
		padding: clamp(1.5rem, 6vh, 4rem) clamp(1.25rem, 8vw, 7rem)
			max(clamp(1.5rem, 6vh, 4rem), env(safe-area-inset-bottom));
	}
	.notes {
		width: 100%;
		max-width: 64rem;
	}
	.prose {
		max-width: 40rem;
	}
	.short .prose {
		max-width: 24em;
		font-size: clamp(1.45rem, 1rem + 1.8vw, 2.4rem);
		line-height: 1.4;
		text-wrap: pretty;
	}
	.short .prose :global(:is(h3, h4, h5)) {
		font-size: 1em;
	}
	h2 {
		margin: 0 0 1rem;
	}
	@media (max-width: 40rem) {
		.notes-screen {
			padding-inline: 1.25rem;
		}
	}
</style>
