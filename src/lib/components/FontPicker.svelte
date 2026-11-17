<script lang="ts" module>
	// The families and their previews are loaded once a picker first opens and
	// kept for the page's life, so reopening one costs nothing.

	let families: Promise<string[]> | undefined;
	function loadFamilies(): Promise<string[]> {
		families ??= import('#lib/client/google-fonts.json').then(
			(module) => module.default,
			(error) => {
				families = undefined; // try again on the next open
				throw error;
			}
		);
		return families;
	}

	/** A preview face's own name, so it cannot stand in for the full family a page uses. */
	const preview = (family: string) => `Qoddy preview ${family}`;

	const requested = new Set<string>();
	let faces: HTMLStyleElement | undefined;

	/**
	 * Loads each family's face for the letters of its own name only (Google's
	 * `text=`), a few kilobytes each, under its preview name. Offline, or for a
	 * family Google no longer has, the name stays in the interface's face.
	 */
	async function loadPreviews(names: string[]): Promise<void> {
		const wanted = names.filter((name) => !requested.has(name));
		for (const name of wanted) requested.add(name);
		const batches = [];
		for (let i = 0; i < wanted.length; i += 20) batches.push(wanted.slice(i, i + 20));
		await Promise.all(
			batches.map(async (batch) => {
				const query = batch.map((name) => `family=${encodeURIComponent(name)}`).join('&');
				const text = encodeURIComponent([...new Set(batch.join(''))].join(''));
				try {
					const response = await fetch(
						`https://fonts.googleapis.com/css2?${query}&text=${text}&display=swap`
					);
					if (!response.ok) throw new Error(`Google Fonts responded ${response.status}`);
					const css = (await response.text()).replace(
						/font-family: '([^']+)'/g,
						(_, name: string) => `font-family: '${preview(name)}'`
					);
					faces ??= document.head.appendChild(document.createElement('style'));
					faces.append(css);
				} catch {
					for (const name of batch) requested.delete(name);
				}
			})
		);
	}
</script>

<script lang="ts">
	// A Google Fonts family. The field shows the chosen one in its own face;
	// it opens a sheet along the bottom of the screen, under the text it sets
	// (`reveal`), which stays in view above it. In the sheet, a search (the
	// editable WAI-ARIA combobox) and the families, each in its own face. The
	// family the pointer or the keys are on is `browsing`, for the page to set
	// its text in. Before a search, the sheet offers a few families of each
	// kind (FONT_PICKS); a search looks through them all. Without the list (offline before it was ever loaded) Enter
	// takes the name as typed.
	import { tick } from 'svelte';
	import { dismissable } from '#lib/client/dismiss.ts';
	import { t } from '#lib/client/i18n.svelte.ts';
	import { validFont } from '#lib/thought.ts';
	import { FONT_PICKS } from '#lib/client/font-picks.ts';
	import Icon from './Icon.svelte';

	let {
		value = $bindable(),
		browsing = $bindable(null),
		labelledby,
		reveal
	}: {
		value: string;
		/** The family being looked at in the open sheet, a moment after it is reached. */
		browsing?: string | null;
		/** The id of the visible label. */
		labelledby: string;
		/** What the sheet must leave in view: the text the font is for. */
		reveal?: HTMLElement;
	} = $props();

	/** At most this many families are listed (and previewed) at once. */
	const SHOWN = 60;

	const id = $props.id();
	let all = $state<string[]>([]);
	let query = $state('');
	let open = $state(false);
	/** The option the keys are on, or -1 for none. Option 0 is the theme's font while there is no search. */
	let active = $state(-1);
	let trigger: HTMLButtonElement | undefined = $state();
	let search: HTMLInputElement | undefined = $state();
	let list: HTMLDivElement | undefined = $state();
	let panel: HTMLDivElement | undefined = $state();
	/** How far the on-screen keyboard reaches up, so the sheet sits on it. */
	let keyboard = $state(0);

	const searching = $derived(query.trim() !== '');
	/** For a search: the name itself, names starting with it, then words starting with it, then the rest, each most popular first. */
	const found = $derived.by(() => {
		const term = query.trim().toLowerCase();
		if (!term) return [];
		const exact: string[] = [];
		const starts: string[] = [];
		const words: string[] = [];
		const contains: string[] = [];
		for (const family of all) {
			const name = family.toLowerCase();
			const at = name.indexOf(term);
			if (name === term) exact.push(family);
			else if (at === 0) starts.push(family);
			else if (at > 0 && name.includes(` ${term}`)) words.push(family);
			else if (at > 0) contains.push(family);
		}
		return [...exact, ...starts, ...words, ...contains];
	});
	/** The options in order: a search's best matches, else the theme's own font ('') and the picks. */
	const shown: string[] = $derived(
		searching ? found.slice(0, SHOWN) : ['', ...FONT_PICKS.flatMap((group) => group.families)]
	);
	const position = $derived(new Map(shown.map((family, index) => [family, index])));

	// The chosen family's name in its own face, on the field.
	$effect(() => {
		if (value) loadPreviews([value]);
	});

	async function show() {
		open = true;
		query = '';
		active = -1;
		await tick();
		search?.focus();
		if (reveal && panel) {
			// The text goes to the top of the page when the sheet would cover it.
			const top = reveal.getBoundingClientRect().top;
			if (top < 0 || top > innerHeight - panel.offsetHeight - 96) {
				const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
				reveal.scrollIntoView({ block: 'start', behavior: still ? 'instant' : 'smooth' });
			}
		}
		if (!all.length) {
			try {
				all = await loadFamilies();
			} catch {
				// Offline before the list was ever loaded: Enter takes the name as typed.
			}
		}
	}

	function hide(refocus = false) {
		open = false;
		active = -1;
		browsing = null;
		if (refocus) trigger?.focus();
	}

	function choose(family: string) {
		value = family;
		hide(true);
	}

	// The visible families' faces load once typing pauses.
	$effect(() => {
		if (!open || !shown.length) return;
		const names = shown.filter(Boolean);
		const timer = setTimeout(() => loadPreviews(names), 150);
		return () => clearTimeout(timer);
	});

	$effect(() => {
		if (open && active >= 0)
			list
				?.querySelector(`#${CSS.escape(`${id}-${active}`)}`)
				?.scrollIntoView({ block: 'nearest' });
	});

	// Passing over families quickly does not load each of them on the page.
	$effect(() => {
		const family = open && active >= 0 ? shown[active] || null : null;
		const timer = setTimeout(() => (browsing = family), family ? 200 : 0);
		return () => clearTimeout(timer);
	});

	// On phones, the keyboard covers the bottom of the page; the sheet rides on it.
	$effect(() => {
		const viewport = window.visualViewport;
		if (!open || !viewport) return;
		const place = () =>
			(keyboard = Math.max(0, innerHeight - viewport.height - viewport.offsetTop));
		place();
		viewport.addEventListener('resize', place);
		viewport.addEventListener('scroll', place);
		return () => {
			viewport.removeEventListener('resize', place);
			viewport.removeEventListener('scroll', place);
		};
	});

	function oninput() {
		// Typing puts the keys on the best match, so Enter takes it.
		active = query.trim() && shown.length ? 0 : -1;
	}

	function onkeydown(event: KeyboardEvent) {
		// Ctrl or ⌘ + Enter belongs to the form.
		if (event.ctrlKey || event.metaKey) return;
		const last = shown.length - 1;
		switch (event.key) {
			case 'ArrowDown':
				active = Math.min(active + 1, last);
				break;
			case 'ArrowUp':
				active = Math.max(active - 1, -1);
				break;
			case 'Enter': {
				const typed = query.trim();
				if (active >= 0) choose(shown[active]);
				else if (!all.length && validFont(typed)) choose(typed);
				break;
			}
			case 'Escape':
				hide(true);
				break;
			default:
				return;
		}
		event.preventDefault();
	}
</script>

{#snippet option(family: string)}
	{@const index = position.get(family) ?? -1}
	<!-- svelte-ignore a11y_click_events_have_key_events (the search takes the keys) -->
	<div
		id="{id}-{index}"
		role="option"
		tabindex="-1"
		aria-selected={family === value}
		class={['option', { active: index === active, none: !family }]}
		style:font-family={family ? `'${preview(family)}', var(--ui-font)` : undefined}
		onpointermove={(event) => {
			// A finger scrolling the list is not looking at what it passes.
			if (event.pointerType !== 'touch') active = index;
		}}
		onclick={() => choose(family)}
	>
		{family || t.write.themeFont}
	</div>
{/snippet}

<div class="font-picker" {@attach open && dismissable(() => hide())}>
	<button
		bind:this={trigger}
		type="button"
		class="trigger"
		aria-labelledby="{labelledby} {id}-value"
		aria-haspopup="dialog"
		aria-expanded={open}
		onclick={() => (open ? hide() : show())}
	>
		<span
			id="{id}-value"
			class={['value', { none: !value }]}
			style:font-family={value ? `'${preview(value)}', var(--ui-font)` : undefined}
			>{value || t.write.themeFont}</span
		>
		<Icon name="search" />
	</button>

	<div
		bind:this={panel}
		class="sheet"
		role="dialog"
		aria-labelledby={labelledby}
		hidden={!open}
		style:--keyboard="{keyboard}px"
	>
		<div class="bar">
			<input
				bind:this={search}
				bind:value={query}
				type="search"
				role="combobox"
				aria-labelledby={labelledby}
				aria-autocomplete="list"
				aria-controls="{id}-list"
				aria-expanded="true"
				aria-activedescendant={active >= 0 ? `${id}-${active}` : undefined}
				placeholder={t.write.fontHint}
				autocomplete="off"
				spellcheck="false"
				enterkeyhint="done"
				{oninput}
				{onkeydown}
			/>
			<button type="button" class="link" onclick={() => hide(true)}>{t.write.fontDone}</button>
		</div>
		<!-- Pressing in the list keeps focus in the search. -->
		<div
			bind:this={list}
			id="{id}-list"
			class="list"
			role="listbox"
			aria-labelledby={labelledby}
			tabindex="-1"
			onpointerdown={(event) => event.preventDefault()}
			onpointerleave={(event) => {
				if (event.pointerType !== 'touch') active = -1;
			}}
		>
			{#if searching}
				<div class="grid">
					{#each shown as family (family)}{@render option(family)}{/each}
				</div>
				{#if all.length && !found.length}
					<p class="note" aria-hidden="true">{t.write.fontNone}</p>
				{:else if found.length > SHOWN}
					<p class="note" aria-hidden="true">{t.write.fontMore(found.length - SHOWN)}</p>
				{/if}
			{:else}
				<div class="grid">{@render option('')}</div>
				{#each FONT_PICKS as group (group.id)}
					<div role="group" class={group.id} aria-labelledby="{id}-{group.id}">
						<h3 id="{id}-{group.id}">{t.write.fontGroups[group.id]}</h3>
						<div class="grid">
							{#each group.families as family (family)}{@render option(family)}{/each}
						</div>
					</div>
				{/each}
				{#if all.length}
					<p class="note" aria-hidden="true">{t.write.fontSearchAll(all.length)}</p>
				{/if}
			{/if}
		</div>
	</div>
</div>

<style>
	/* The field: filled like the text fields beside it. */
	.trigger {
		appearance: none;
		display: flex;
		align-items: center;
		gap: 0.6rem;
		width: 100%;
		min-height: 2.75rem;
		padding: 0.4em 0.7em 0.4em 0.8em;
		border: 1px solid transparent;
		border-radius: calc(var(--radius) + 2px);
		background: var(--wash);
		color: inherit;
		font-family: var(--ui-font);
		font-size: 0.95rem;
		line-height: 1.4;
		text-align: start;
		cursor: pointer;
		transition:
			background-color 0.2s var(--ease),
			border-color 0.2s var(--ease),
			box-shadow 0.2s var(--ease);
	}
	@media (hover: hover) {
		.trigger:hover {
			background: color-mix(in oklab, var(--ink) 10%, var(--paper));
		}
	}
	.trigger:focus-visible,
	.trigger[aria-expanded='true'] {
		outline: none;
		border-color: color-mix(in oklab, var(--accent) 70%, transparent);
		box-shadow: 0 0 0 3px color-mix(in oklab, var(--accent) 22%, transparent);
	}
	.value {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 1.15rem;
	}
	.value.none {
		font-size: inherit;
	}
	.trigger :global(svg) {
		flex: none;
		width: 1.1rem;
		height: 1.1rem;
		color: var(--muted);
	}

	/* The sheet: along the bottom of the screen (on the keyboard, when there is
	   one), the lower part of it only, so the text above stays in view. */
	.sheet {
		position: fixed;
		z-index: 5;
		inset-inline: 0;
		bottom: var(--keyboard, 0px);
		display: flex;
		flex-direction: column;
		width: min(100%, 60rem);
		height: min(46dvh, 30rem);
		margin-inline: auto;
		padding: 0.75rem clamp(0.75rem, 3vw, 1.25rem) max(0.5rem, env(safe-area-inset-bottom));
		border-radius: calc(var(--radius) + 12px) calc(var(--radius) + 12px) 0 0;
		--sheet: light-dark(
			color-mix(in oklab, var(--paper) 30%, #fff),
			color-mix(in oklab, var(--ink) 14%, var(--paper))
		);
		background: var(--sheet);
		box-shadow:
			0 0 0 1px color-mix(in oklab, var(--ink) 10%, transparent),
			var(--lift);
		transition:
			opacity 0.2s var(--ease),
			translate 0.3s var(--ease),
			display 0.3s allow-discrete;
		@starting-style {
			opacity: 0;
			translate: 0 2rem;
		}
	}
	.sheet[hidden] {
		display: none;
		opacity: 0;
		translate: 0 2rem;
	}
	.bar {
		display: flex;
		align-items: center;
		gap: 1.25rem;
		padding-bottom: 0.6rem;
	}
	.bar .link {
		margin-inline-end: 0;
	}

	/* The families side by side as room allows, read across; before a search,
	   in their kinds, each kind's name staying in view over its families. */
	.list {
		flex: 1;
		overflow-y: auto;
		overscroll-behavior: contain;
		margin: 0 -0.35rem;
		padding: 0 0.35rem 0.35rem;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 12.5rem), 1fr));
		gap: 0.15rem;
	}
	h3 {
		position: sticky;
		z-index: 1;
		top: 0;
		margin: 0.6rem 0 0.15rem;
		padding: 0.35rem 0.6rem;
		background: var(--sheet);
		font-family: var(--ui-font);
		font-size: 0.78rem;
		font-weight: 600;
		color: var(--muted);
	}
	.option {
		display: flex;
		align-items: center;
		min-height: 3rem;
		padding: 0.3em 0.6em;
		border-radius: calc(var(--radius) + 2px);
		font-size: 1.35rem;
		line-height: 1.25;
		overflow-wrap: anywhere;
		cursor: pointer;
	}
	/* Scripts are small on their body; they get room to be read. */
	.script .option {
		font-size: 1.7rem;
	}
	.option.none {
		font-family: var(--ui-font);
		font-size: 0.95rem;
		color: var(--muted);
	}
	.option.active {
		background: color-mix(in oklab, var(--accent) 13%, transparent);
	}
	.option[aria-selected='true'] {
		color: var(--accent);
		box-shadow: inset 0 0 0 1.5px color-mix(in oklab, var(--accent) 45%, transparent);
	}
	/* Phones: two narrower columns. */
	@media (max-width: 30rem) {
		.grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.option {
			font-size: 1.1rem;
		}
		.script .option {
			font-size: 1.4rem;
		}
	}
	.note {
		margin: 0.5rem 0 0;
		padding: 0.35rem 0.6rem;
		font-family: var(--ui-font);
		font-size: 0.8rem;
		color: var(--muted);
	}
</style>
