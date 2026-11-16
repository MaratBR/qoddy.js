<script lang="ts">
	import { onMount } from 'svelte';
	import { page, updated } from '$app/state';
	import { afterNavigate } from '$app/navigation';
	import { library } from '#lib/client/library.svelte.ts';
	import { makeAvailableOffline } from '#lib/client/offline.ts';
	import { fontHref, look } from '#lib/client/look.svelte.ts';
	import { i18n, t } from '#lib/client/i18n.svelte.ts';
	import LanguagePicker from '#lib/components/LanguagePicker.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import { findTheme, THEMES } from '#lib/themes.ts';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
	let menu: HTMLDialogElement | undefined = $state();
	/** The collection the site puts on the home page, which a reader may swap for their own thoughts. */
	const siteHome = $derived(library.collections.find((c) => c.id === library.settings.home));
	/** The bar's height, as `--bar`: a page's first screen is the window below it. */
	let barHeight = $state(0);
	$effect(() => {
		document.documentElement.style.setProperty('--bar', `${barHeight}px`);
	});

	onMount(() => {
		void library.init();
		makeAvailableOffline();
	});

	// Close the menu on navigation; check for a new service worker meanwhile.
	afterNavigate(() => {
		menu?.close();
		void navigator.serviceWorker?.getRegistration().then((registration) => registration?.update());
	});

	const theme = $derived(findTheme(look.theme) ?? findTheme(library.theme) ?? THEMES[0]);
	const readerTheme = $derived(findTheme(library.theme) ?? THEMES[0]);

	$effect(() => {
		const root = document.documentElement;
		root.lang = i18n.locale;
		root.dataset.theme = theme.id;
		if (library.mode && theme.dark) root.dataset.mode = library.mode;
		else delete root.dataset.mode;
		if (look.color) {
			root.dataset.tinted = '';
			root.style.setProperty('--thought-color', look.color);
		} else {
			delete root.dataset.tinted;
			root.style.removeProperty('--thought-color');
		}
		if (look.font) root.style.setProperty('--thought-font', `'${look.font}', var(--font)`);
		else root.style.removeProperty('--thought-font');
	});

	// Theme changes fade (base.css), but only once the first frames are drawn
	// in the reader's theme: fading in from the browser's blank page flashes.
	$effect(() => {
		if (!library.ready) return;
		requestAnimationFrame(() =>
			requestAnimationFrame(() => (document.documentElement.dataset.settled = ''))
		);
	});

	const chrome = $derived.by(() => {
		if (!theme.dark || library.mode === 'light') return theme.light;
		if (library.mode === 'dark') return theme.dark;
		return null;
	});

	const status = $derived.by(() => {
		if (!library.online) return t.status.offline;
		if (library.syncError) return library.syncError;
		if (library.signedIn && library.pending > 0) {
			return library.locked
				? t.status.pendingLocked(library.pending)
				: t.status.pending(library.pending);
		}
		if (library.signedIn) return t.status.inSync;
		return t.status.local;
	});

	const current = (href: string) => (page.url.pathname === href ? 'page' : undefined);
</script>

<svelte:head>
	<title>{library.settings.site_name}</title>
	{#if chrome}
		<meta name="theme-color" content={chrome} />
	{:else}
		<meta name="theme-color" content={theme.light} media="(prefers-color-scheme: light)" />
		<meta name="theme-color" content={theme.dark} media="(prefers-color-scheme: dark)" />
	{/if}
	{#if look.font}
		<link rel="stylesheet" href={fontHref(look.font)} />
	{/if}
</svelte:head>

<header class="bar" bind:offsetHeight={barHeight}>
	<a class="name" href="/">{library.settings.site_name}</a>
	{#if !library.online}<span class="offline">{t.bar.offline}</span>{/if}
	<nav>
		<a class="link" href="/write" aria-current={current('/write')}>{t.bar.write}</a>
		<button class="link" onclick={() => menu?.showModal()} aria-haspopup="dialog"
			>{t.bar.menu}</button
		>
	</nav>
</header>

{#if updated.current}
	<p class="update">
		<span>{t.bar.updateReady(library.settings.site_name)}</span>
		<button class="link" onclick={() => location.reload()}>{t.bar.reload}</button>
	</p>
{/if}

{#if library.ready}
	{@render children()}
{/if}

<dialog
	bind:this={menu}
	class="sheet"
	aria-label={t.bar.menu}
	onclick={(event) => event.target === menu && menu.close()}
>
	<div class="sheet-body">
		<button class="link close" onclick={() => menu?.close()}>{t.menu.close}</button>

		<section>
			<h2 class="label">{t.menu.read}</h2>
			<ul class="group">
				{#if library.homeId !== null}
					<li>
						<a href="/" aria-current={current('/')}>
							<span class="title">{t.menu.today}</span>
							<Icon name="chevron" />
						</a>
					</li>
				{/if}
				{#each library.collections.filter((c) => !library.isHome(c)) as collection (collection.id)}
					<li>
						<a href="/c/{collection.slug}" aria-current={current(`/c/${collection.slug}`)}>
							<span class="title">{collection.name}</span>
							<span class="count">{library.countIn(collection.id)}</span>
							<Icon name="chevron" />
						</a>
					</li>
				{/each}
				<li>
					<a href="/c/mine" aria-current={current('/c/mine')}>
						<span class="title">{t.common.yourThoughts}</span>
						<span class="count">{library.mine.length}</span>
						<Icon name="chevron" />
					</a>
				</li>
			</ul>
		</section>

		{#if siteHome}
			<section>
				<h2 class="label">{t.menu.home}</h2>
				<div class="segmented home" role="radiogroup" aria-label={t.menu.home}>
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
			<h2 class="label">{t.menu.theme}</h2>
			<div class="themes" role="radiogroup" aria-label={t.menu.theme}>
				{#each THEMES as option (option.id)}
					<button
						role="radio"
						aria-checked={readerTheme.id === option.id}
						class="swatch"
						data-swatch={option.id}
						onclick={() => library.setTheme(option.id)}
					>
						<span class="sample" style:background={option.light}>Aa</span>
						<span class="swatch-name">{t.themes[option.id] ?? option.name}</span>
					</button>
				{/each}
			</div>
			{#if readerTheme.dark}
				<div class="segmented modes" role="radiogroup" aria-label={t.menu.lightOrDark}>
					{#each [null, 'light', 'dark'] as const as value (value)}
						<button
							role="radio"
							aria-checked={library.mode === value}
							onclick={() => library.setMode(value)}>{t.menu.modes[value ?? 'system']}</button
						>
					{/each}
				</div>
			{/if}
			{#if look.theme && look.theme !== readerTheme.id}
				<p class="hint">{t.menu.ownTheme}</p>
			{/if}
		</section>

		<section>
			<h2 class="label">{t.menu.language}</h2>
			<LanguagePicker />
		</section>

		<section>
			<h2 class="label">{t.menu.account}</h2>
			<ul class="group">
				<li>
					<a href="/account" aria-current={current('/account')}>
						<span class="title">{library.me ? library.me.name : t.menu.signInOrCreate}</span>
						<Icon name="chevron" />
					</a>
				</li>
				{#if library.me?.role === 'admin'}
					<li>
						<a href="/admin" data-sveltekit-reload>
							<span class="title">{t.menu.dashboard}</span>
							<Icon name="chevron" />
						</a>
					</li>
				{/if}
			</ul>
			<p class="hint status">{status}</p>
		</section>
	</div>
</dialog>

<style>
	/* The bar, then the page filling the rest of the window (`main { flex: 1 }`). */
	:global(body) {
		display: flex;
		flex-direction: column;
	}
	/* Stays at the top, transparent: the page itself shows through, so the bar
	   follows <html>'s color as it fades between themes and tints. A paint of
	   its own (a --paper mix) would jump there while the page fades. Once the
	   page scrolls under it, it gains a frosted tint and a hairline. The blur
	   alone leaves a plain page exactly as it is. */
	.bar {
		position: sticky;
		top: 0;
		z-index: 1;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: max(0.5rem, env(safe-area-inset-top)) clamp(1.25rem, 5vw, 3.5rem) 0.25rem;
		min-height: 3.5rem;
		background: transparent;
		-webkit-backdrop-filter: blur(20px);
		backdrop-filter: blur(20px);
		border-bottom: 1px solid transparent;
	}
	@supports (animation-timeline: scroll()) {
		.bar {
			animation: material linear both;
			animation-timeline: scroll();
			animation-range: 0 3rem;
		}
		@keyframes material {
			to {
				background-color: color-mix(in oklab, var(--paper) 72%, transparent);
				border-bottom-color: color-mix(in oklab, var(--rule) 80%, transparent);
			}
		}
	}
	.name {
		font-weight: 650;
		text-decoration: none;
		letter-spacing: -0.005em;
	}
	.offline {
		font-family: var(--ui-font);
		font-size: 0.72rem;
		font-weight: 600;
		color: var(--muted);
		background: color-mix(in oklab, var(--ink) 7%, transparent);
		border-radius: 999px;
		padding: 0.2em 0.7em;
	}
	/* The bar's two actions as capsules, as a toolbar's buttons are drawn; the
	   page you are on takes the accent. */
	nav {
		margin-inline-start: auto;
		display: flex;
		gap: 0.5rem;
	}
	nav .link {
		margin: 0;
		min-height: 2.4rem;
		padding: 0 1rem;
		border-radius: 999px;
		color: var(--ink);
		font-weight: 550;
		background: color-mix(in oklab, var(--ink) 6%, transparent);
	}
	@media (hover: hover) {
		nav .link:hover {
			background: color-mix(in oklab, var(--ink) 10%, transparent);
		}
	}
	nav .link:active {
		background: color-mix(in oklab, var(--ink) 14%, transparent);
	}
	nav .link[aria-current='page'] {
		color: var(--accent);
		background: color-mix(in oklab, var(--accent) 14%, transparent);
	}
	.update {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0 1rem;
		width: fit-content;
		max-width: calc(100% - 2.5rem);
		margin: 0.25rem auto 0;
		padding: 0.15rem 0.5rem 0.15rem 1.1rem;
		border-radius: 999px;
		background: color-mix(in oklab, var(--ink) 7%, transparent);
		font-family: var(--ui-font);
		font-size: 0.85rem;
		color: var(--muted);
	}
	.update .link {
		margin: 0;
		border-radius: 999px;
	}

	/* The menu: a panel of frosted material floating at the right edge (a
	   sheet from the bottom on phones), lists grouped as on a settings page. */
	.sheet {
		--inset: 0.75rem;
		margin: var(--inset) var(--inset) var(--inset) auto;
		max-height: calc(100dvh - 2 * var(--inset));
		height: calc(100dvh - 2 * var(--inset));
		width: min(23rem, 100vw - 2 * var(--inset));
		max-width: none;
		padding: 0;
		border: 1px solid color-mix(in oklab, var(--ink) 9%, transparent);
		border-radius: calc(var(--radius) + 10px);
		background: var(--paper);
		color: var(--ink);
		box-shadow:
			0 0.25rem 1rem -0.25rem color-mix(in oklab, #000 18%, transparent),
			var(--lift);
		overscroll-behavior: contain;
	}
	@supports (backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)) {
		.sheet {
			background: color-mix(in oklab, var(--paper) 82%, transparent);
			-webkit-backdrop-filter: blur(28px) saturate(1.8);
			backdrop-filter: blur(28px) saturate(1.8);
		}
	}
	.sheet::backdrop {
		background: color-mix(in oklab, var(--ink) 18%, transparent);
	}
	.sheet[open] {
		animation: slide-in 0.45s var(--ease);
	}
	.sheet[open]::backdrop {
		animation: fade 0.3s ease-out;
	}
	@keyframes slide-in {
		from {
			transform: translateX(1.5rem);
			opacity: 0;
		}
	}
	@keyframes fade {
		from {
			opacity: 0;
		}
	}
	.sheet-body {
		padding: 0.5rem 1.25rem 1.75rem;
	}
	.close {
		display: flex;
		margin-inline-start: auto;
		text-decoration: none;
		font-weight: 600;
		color: var(--accent);
	}
	section {
		margin-top: 1.25rem;
	}
	section:first-of-type {
		margin-top: 0;
	}
	section h2 {
		margin: 0 0 0.4rem;
		padding-inline-start: 0.9rem;
	}

	/* An inset group: rows on a raised fill, hairlines between them that
	   start where the text does. */
	.group {
		list-style: none;
		margin: 0;
		padding: 0;
		border-radius: calc(var(--radius) + 4px);
		background: color-mix(in oklab, var(--ink) 5%, transparent);
		overflow: hidden;
	}
	.group li + li a::before {
		content: '';
		position: absolute;
		top: 0;
		inset-inline: 0.9rem 0;
		border-top: 1px solid color-mix(in oklab, var(--ink) 10%, transparent);
	}
	.group a {
		position: relative;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-height: 2.9rem;
		padding: 0.5rem 0.75rem 0.5rem 0.9rem;
		text-decoration: none;
		font-size: 1.05rem;
		line-height: 1.3;
		transition: background-color 0.2s var(--ease);
	}
	.group a:hover {
		background: color-mix(in oklab, var(--ink) 5%, transparent);
	}
	.group a:active {
		background: color-mix(in oklab, var(--ink) 10%, transparent);
		transition-duration: 0s;
	}
	.group a:focus-visible {
		outline-offset: -3px;
		border-radius: inherit;
	}
	.title {
		flex: 1;
		min-width: 0;
	}
	.group a[aria-current='page'] .title {
		color: var(--accent);
		font-weight: 600;
	}
	.count {
		font-family: var(--ui-font);
		font-size: 0.85rem;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}
	.group :global(svg) {
		width: 0.9rem;
		height: 0.9rem;
		flex: none;
		color: color-mix(in oklab, var(--muted) 70%, transparent);
	}
	.group :global(svg:dir(rtl)) {
		transform: scaleX(-1);
	}

	/* Themes as previews to pick from, the chosen one ringed. */
	.themes {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.75rem;
	}
	.swatch {
		appearance: none;
		background: none;
		border: 0;
		padding: 0;
		display: grid;
		gap: 0.4rem;
		justify-items: center;
		cursor: pointer;
		font-family: var(--ui-font);
		font-size: 0.8rem;
		color: var(--muted);
		min-height: 2.75rem;
	}
	.swatch:focus-visible {
		outline: none;
	}
	.swatch:focus-visible .sample {
		outline: 3px solid color-mix(in oklab, var(--accent) 55%, transparent);
		outline-offset: 2px;
	}
	.sample {
		display: grid;
		place-items: center;
		width: 100%;
		aspect-ratio: 3 / 2;
		border-radius: calc(var(--radius) + 2px);
		font-size: 1.5rem;
		line-height: 1;
		box-shadow:
			inset 0 0 0 1px color-mix(in oklab, #000 10%, transparent),
			0 1px 3px color-mix(in oklab, #000 12%, transparent);
		transition:
			box-shadow 0.25s var(--ease),
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
		box-shadow:
			inset 0 0 0 1px color-mix(in oklab, #000 10%, transparent),
			0 0 0 2px var(--paper),
			0 0 0 4px var(--accent);
	}
	[data-swatch='morning'] .sample {
		font-family: 'Alegreya Variable', serif;
		color: #1c2420;
	}
	[data-swatch='vesper'] .sample {
		font-family: 'Bodoni Moda Variable', serif;
		font-style: italic;
		color: #f2e8dc;
	}
	[data-swatch='field'] .sample {
		font-family: 'Bricolage Grotesque Variable', sans-serif;
		font-weight: 700;
		color: #2c47d0;
	}
	.home {
		display: flex;
	}
	.modes {
		display: flex;
		margin-top: 1rem;
	}
	.themes + .hint,
	.modes + .hint {
		margin-top: 0.6rem;
		padding-inline: 0.9rem;
	}
	.status {
		margin-top: 0.5rem;
		padding-inline: 0.9rem;
	}

	@media (max-width: 40rem) {
		.sheet {
			width: 100vw;
			height: auto;
			max-height: calc(100dvh - max(2.5rem, env(safe-area-inset-top)));
			margin: auto 0 0;
			border-width: 1px 0 0;
			border-radius: calc(var(--radius) + 10px) calc(var(--radius) + 10px) 0 0;
		}
		.sheet[open] {
			animation-name: slide-up;
		}
		.sheet-body {
			padding-bottom: max(1.75rem, env(safe-area-inset-bottom));
		}
		@keyframes slide-up {
			from {
				transform: translateY(100%);
			}
		}
	}
</style>
