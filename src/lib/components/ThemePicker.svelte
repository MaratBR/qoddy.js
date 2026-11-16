<script lang="ts">
	// The reader's theme as previews to pick from, the chosen one ringed, each
	// in the current mode and accent. Shown in the menu and on Account → Appearance.
	import { library } from '#lib/client/library.svelte.ts';
	import { look } from '#lib/client/look.svelte.ts';
	import { t } from '#lib/client/i18n.svelte.ts';
	import { findTheme, THEMES } from '#lib/themes.ts';

	const readerTheme = $derived(findTheme(library.theme) ?? THEMES[0]);
</script>

<div class="themes" role="radiogroup" aria-label={t.menu.theme}>
	{#each THEMES as option (option.id)}
		<button
			role="radio"
			aria-checked={readerTheme.id === option.id}
			class="swatch"
			onclick={() => library.setTheme(option.id)}
		>
			<!-- The theme itself, in place: its tokens apply to this element. -->
			<span class="sample" data-theme={option.id} aria-hidden="true">Aa</span>
			<span>{t.themes[option.id] ?? option.name}</span>
		</button>
	{/each}
</div>
{#if look.theme && look.theme !== readerTheme.id}
	<p class="hint">{t.menu.ownTheme}</p>
{:else if look.color}
	<p class="hint">{t.menu.ownColor}</p>
{/if}

<style>
	/* One row, however many themes: they share the width while they fit and
	   scroll sideways once they do not. The padding keeps the rings in view. */
	.themes {
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: minmax(5.5rem, 1fr);
		gap: 0.75rem;
		margin: -0.4rem;
		padding: 0.4rem;
		overflow-x: auto;
		overscroll-behavior-x: contain;
		scroll-snap-type: x mandatory;
		scroll-padding-inline: 0.4rem;
		scrollbar-width: none;
	}
	.themes::-webkit-scrollbar {
		display: none;
	}
	.swatch {
		appearance: none;
		background: none;
		border: 0;
		padding: 0;
		display: grid;
		gap: 0.4rem;
		justify-items: center;
		scroll-snap-align: start;
		cursor: pointer;
		font-family: var(--ui-font);
		font-size: 0.8rem;
		color: var(--muted);
		min-height: 2.75rem;
	}
	.swatch:focus-visible {
		outline: none;
	}
	/* Paper, ink, face and corners are the theme's; the ring is the page's accent. */
	.sample {
		display: grid;
		place-items: center;
		width: 100%;
		aspect-ratio: 3 / 2;
		border-radius: calc(var(--radius) + 2px);
		background: var(--paper);
		color: var(--ink);
		font-family: var(--font);
		font-weight: var(--thought-weight);
		font-style: var(--thought-style);
		letter-spacing: var(--thought-tracking);
		font-size: 1.5rem;
		line-height: 1;
		box-shadow:
			inset 0 0 0 1px color-mix(in oklab, var(--ink) 12%, transparent),
			0 1px 3px color-mix(in oklab, #000 12%, transparent);
		outline: 0 solid transparent;
		outline-offset: 2px;
		transition:
			outline-color 0.25s var(--ease),
			transform 0.3s var(--ease);
	}
	.swatch:active .sample {
		transform: scale(0.96);
	}
	.swatch[aria-checked='true'] {
		color: var(--ink);
		font-weight: 600;
	}
	.swatch[aria-checked='true'] .sample {
		outline: 2px solid var(--accent);
	}
	.swatch:focus-visible .sample {
		outline: 3px solid color-mix(in oklab, var(--accent) 55%, transparent);
	}
	.hint {
		margin-top: 0.75rem;
		padding-inline: 0.9rem;
	}
</style>
