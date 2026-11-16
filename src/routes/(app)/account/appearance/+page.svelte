<script lang="ts">
	// Account → Appearance: light or dark, color (the accent), theme (all the
	// rest), paper, what the home page shows, and the language. Kept on this
	// device; the language also in the account.
	import { library } from '#lib/client/library.svelte.ts';
	import { t } from '#lib/client/i18n.svelte.ts';
	import SettingsPage from '#lib/components/SettingsPage.svelte';
	import ThemePicker from '#lib/components/ThemePicker.svelte';
	import ColorPicker from '#lib/components/ColorPicker.svelte';
	import LanguagePicker from '#lib/components/LanguagePicker.svelte';

	/** Soft paper tones; each theme mixes the chosen one into its own paper. */
	const TONES = [
		{ name: 'blush', hex: '#f4c7cf' },
		{ name: 'peach', hex: '#f7d3b5' },
		{ name: 'butter', hex: '#f5e6a3' },
		{ name: 'mint', hex: '#bfe3cf' },
		{ name: 'sky', hex: '#bcd8f0' },
		{ name: 'lavender', hex: '#d6cbef' },
		{ name: 'sand', hex: '#e3d5bd' }
	] as const;
	/** Where the accent starts when the reader first picks their own. */
	const DEFAULT_ACCENT = '#2f5d9e';

	/** Without a home collection set by the site, home always shows the reader's own thoughts. */
	const siteHome = $derived(library.collections.find((c) => c.id === library.settings.home));
</script>

<SettingsPage title={t.account.appearance}>
	<section>
		<h2 class="label">{t.menu.lightOrDark}</h2>
		<div class="segmented" role="radiogroup" aria-label={t.menu.lightOrDark}>
			{#each [null, 'light', 'dark'] as const as value (value)}
				<button
					role="radio"
					aria-checked={library.mode === value}
					onclick={() => library.setMode(value)}>{t.menu.modes[value ?? 'system']}</button
				>
			{/each}
		</div>
	</section>

	<section>
		<h2 class="label">{t.menu.accent}</h2>
		<div class="colors">
			<label class="switch-row">
				{t.menu.defaultColor}
				<input
					type="checkbox"
					role="switch"
					checked={library.accent === null}
					onchange={(event) =>
						library.setAccent(event.currentTarget.checked ? null : DEFAULT_ACCENT)}
				/>
			</label>
			{#if library.accent !== null}
				<ColorPicker
					bind:value={() => library.accent ?? DEFAULT_ACCENT, (color) => library.setAccent(color)}
					label={t.menu.accent}
				/>
			{/if}
		</div>
	</section>

	<section>
		<h2 class="label">{t.menu.theme}</h2>
		<ThemePicker />
	</section>

	<section>
		<h2 class="label">{t.menu.paper}</h2>
		<div class="tones" role="radiogroup" aria-label={t.menu.paper}>
			<button
				role="radio"
				class="tone own"
				aria-checked={library.tone === null}
				aria-label={t.menu.themeOwn}
				title={t.menu.themeOwn}
				onclick={() => library.setTone(null)}
			></button>
			{#each TONES as tone (tone.hex)}
				<button
					role="radio"
					class="tone"
					style:--tone={tone.hex}
					aria-checked={library.tone === tone.hex}
					aria-label={t.menu.tones[tone.name]}
					title={t.menu.tones[tone.name]}
					onclick={() => library.setTone(tone.hex)}
				></button>
			{/each}
		</div>
	</section>

	{#if siteHome}
		<section>
			<h2 class="label">{t.menu.home}</h2>
			<div class="segmented" role="radiogroup" aria-label={t.menu.home}>
				{#each [false, true] as value (value)}
					<button
						role="radio"
						aria-checked={library.homeMine === value}
						onclick={() => library.setHomeMine(value)}
						>{value ? t.common.yourThoughts : siteHome.name}</button
					>
				{/each}
			</div>
		</section>
	{/if}

	<section>
		<h2 class="label">{t.menu.language}</h2>
		<LanguagePicker />
		{#if library.me}<p class="hint">{t.account.languageSaved}</p>{/if}
	</section>
</SettingsPage>

<style>
	.segmented {
		display: flex;
	}
	.colors {
		display: grid;
		gap: 0.85rem;
	}
	.tones {
		display: flex;
		flex-wrap: wrap;
		gap: 0.55rem;
	}
	.tone {
		appearance: none;
		width: 2.25rem;
		height: 2.25rem;
		min-height: 0;
		margin: 0;
		padding: 0;
		border: 0;
		border-radius: 50%;
		background: var(--tone);
		box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--ink) 14%, transparent);
		cursor: pointer;
		transition: box-shadow 0.2s var(--ease);
	}
	/* The theme's own paper, ringed. */
	.tone.own {
		background: light-dark(var(--paper-light), var(--paper-dark));
		box-shadow: inset 0 0 0 1.5px color-mix(in oklab, var(--ink) 35%, transparent);
	}
	.tone[aria-checked='true'] {
		box-shadow:
			inset 0 0 0 1px color-mix(in oklab, var(--ink) 14%, transparent),
			0 0 0 2.5px var(--paper),
			0 0 0 4.5px var(--accent);
	}
	.tone:focus-visible {
		outline-offset: 5px;
	}
	.hint {
		margin-top: 0.6rem;
	}
</style>
