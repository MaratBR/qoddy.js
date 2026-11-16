<script lang="ts">
	import { onMount } from 'svelte';
	import { page, updated } from '$app/state';
	import { afterNavigate } from '$app/navigation';
	import { library } from '#lib/client/library.svelte.ts';
	import { makeAvailableOffline } from '#lib/client/offline.ts';
	import { fontHref, look, resolveColor, toHex } from '#lib/client/look.svelte.ts';
	import { i18n, t } from '#lib/client/i18n.svelte.ts';
	import Icon from '#lib/components/Icon.svelte';
	import AppLock from '#lib/components/AppLock.svelte';
	import ThemePicker from '#lib/components/ThemePicker.svelte';
	import { findTheme, THEMES } from '#lib/themes.ts';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
	let menu: HTMLDialogElement | undefined = $state();
	/** The bar's height, as `--bar`: a page's first screen is the window below it. */
	let barHeight = $state(0);
	$effect(() => {
		document.documentElement.style.setProperty('--bar', `${barHeight}px`);
	});

	/** Bumped when the system turns light or dark, to recolor the browser's bar. */
	let scheme = $state(0);
	onMount(() => {
		void library.init();
		makeAvailableOffline();
		const query = matchMedia('(prefers-color-scheme: dark)');
		const changed = () => scheme++;
		query.addEventListener('change', changed);
		return () => query.removeEventListener('change', changed);
	});

	// Close the menu on navigation; check for a new service worker meanwhile.
	afterNavigate(() => {
		menu?.close();
		void navigator.serviceWorker?.getRegistration().then((registration) => registration?.update());
	});

	const theme = $derived(findTheme(look.theme) ?? findTheme(library.theme) ?? THEMES[0]);

	$effect(() => {
		const root = document.documentElement;
		root.lang = i18n.locale;
		root.dataset.theme = theme.id;
		if (library.mode) root.dataset.mode = library.mode;
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
		for (const [name, value] of [
			['accent', library.accent],
			['tone', library.tone]
		] as const) {
			if (value) {
				root.dataset[name] = '';
				root.style.setProperty(`--reader-${name}`, value);
			} else {
				delete root.dataset[name];
				root.style.removeProperty(`--reader-${name}`);
			}
		}
		// The browser's bar takes the page's paper. One meta, changed in place:
		// iOS reads the first theme-color meta and ignores ones added later.
		void scheme;
		const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
		if (meta) meta.content = toHex(resolveColor('--paper'));
	});

	// Theme changes fade (base.css), but only once the first frames are drawn
	// in the reader's theme: fading in from the browser's blank page flashes.
	$effect(() => {
		if (!library.ready) return;
		requestAnimationFrame(() =>
			requestAnimationFrame(() => (document.documentElement.dataset.settled = ''))
		);
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

	/** The menu's reading list: today, collections with something in them, your own. */
	const shelf = $derived([
		...(library.homeId !== null ? [{ href: '/', title: t.menu.today, count: null }] : []),
		// Empty collections stay out of the way until they have something to read.
		...library.collections
			.filter((c) => !library.isHome(c) && library.countIn(c.id) > 0)
			.map((c) => ({ href: `/c/${c.slug}`, title: c.name, count: library.countIn(c.id) })),
		{ href: '/c/mine', title: t.common.yourThoughts, count: library.mine.length }
	]);
</script>

<svelte:head>
	<title>{library.settings.site_name}</title>
	{#if look.font}
		<link rel="stylesheet" href={fontHref(look.font)} />
	{/if}
</svelte:head>

<header class="bar" bind:offsetHeight={barHeight}>
	<a class="name" href="/">{library.settings.site_name}</a>
	{#if !library.online}<span class="offline">{t.bar.offline}</span>{/if}
	{#if !library.appLocked}
		<nav>
			<a class="link" href="/write" aria-current={current('/write')}>{t.bar.write}</a>
			<button class="link" onclick={() => menu?.showModal()} aria-haspopup="dialog"
				>{t.bar.menu}</button
			>
		</nav>
	{/if}
</header>

{#if updated.current}
	<p class="update">
		<span>{t.bar.updateReady(library.settings.site_name)}</span>
		<button class="link" onclick={() => location.reload()}>{t.bar.reload}</button>
	</p>
{/if}

{#if library.ready}
	{@render children()}
{:else if library.appLocked}
	<AppLock />
{/if}

<dialog bind:this={menu} class="menu" aria-label={t.bar.menu}>
	<div class="menu-top">
		<span class="name">{library.settings.site_name}</span>
		<button class="link close" onclick={() => menu?.close()}>{t.menu.close}</button>
	</div>

	<div class="menu-body">
		<!-- What to read, large, in the reading face: the menu's reason to exist. -->
		<section class="reading">
			<h2 class="label">{t.menu.read}</h2>
			<ul class="shelf">
				{#each shelf as entry, i (entry.href)}
					<li style:--i={i}>
						<a href={entry.href} aria-current={current(entry.href)}>
							<span class="title">{entry.title}</span>
							{#if entry.count !== null}<span class="count">{entry.count}</span>{/if}
							<Icon name="next" />
						</a>
					</li>
				{/each}
			</ul>
		</section>

		<div class="side">
			<section>
				<h2 class="label">{t.menu.theme}</h2>
				<ThemePicker />
			</section>

			<section>
				<h2 class="label">{t.menu.account}</h2>
				<ul class="group">
					<li>
						<a href="/account" aria-current={current('/account')}>
							<span class="title"
								>{library.me
									? library.me.name
									: library.settings.allow_sign_up
										? t.menu.signInOrCreate
										: t.menu.signIn}</span
							>
							<Icon name="chevron" />
						</a>
					</li>
					<li>
						<a href="/account/appearance" aria-current={current('/account/appearance')}>
							<span class="title">{t.account.appearance}</span>
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

	/* The menu: a page of its own over everything, opening from the button that
	   called it. What to read comes first and large, in the reading face; the
	   look and the account sit beside it (below on phones). */
	.menu {
		width: 100%;
		height: 100%;
		max-width: none;
		max-height: none;
		margin: 0;
		padding: 0 clamp(1.25rem, 5vw, 3.5rem) max(2rem, env(safe-area-inset-bottom));
		border: 0;
		color: var(--ink);
		background:
			radial-gradient(
				ellipse 70% 55% at 100% 0%,
				color-mix(in oklab, var(--accent) 16%, transparent),
				transparent
			),
			radial-gradient(
				ellipse 60% 50% at 0% 100%,
				color-mix(in oklab, var(--accent) 8%, transparent),
				transparent
			),
			var(--paper);
		overflow-y: auto;
		overscroll-behavior: contain;
	}
	.menu::backdrop {
		background: transparent;
	}
	.menu[open] {
		animation: open-menu 0.6s var(--ease);
	}
	@keyframes open-menu {
		from {
			clip-path: circle(1.5rem at calc(100% - 3.5rem) 1.75rem);
		}
		to {
			clip-path: circle(150% at calc(100% - 3.5rem) 1.75rem);
		}
	}
	/* The bar again, the close where the menu button was. */
	.menu-top {
		position: sticky;
		top: 0;
		z-index: 1;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		min-height: 3.5rem;
		padding-top: max(0.5rem, env(safe-area-inset-top));
		padding-bottom: 0.25rem;
	}
	.close {
		margin: 0;
		min-height: 2.4rem;
		padding: 0 1rem;
		border-radius: 999px;
		color: var(--ink);
		font-weight: 550;
		background: color-mix(in oklab, var(--ink) 6%, transparent);
	}
	.menu-body {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 2.5rem;
		max-width: 72rem;
		margin: clamp(1.5rem, 6vh, 4rem) auto 0;
	}
	@media (min-width: 56rem) {
		.menu-body {
			grid-template-columns: minmax(0, 1.5fr) minmax(18rem, 1fr);
			gap: clamp(2.5rem, 6vw, 6rem);
			align-items: start;
		}
	}
	.reading h2 {
		margin: 0 0 0.75rem;
		padding: 0;
	}
	.shelf {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.shelf li {
		border-top: 1px solid color-mix(in oklab, var(--ink) 10%, transparent);
		animation: rise 0.6s var(--ease) both;
		animation-delay: calc(0.08s + var(--i) * 0.045s);
	}
	.shelf li:last-child {
		border-bottom: 1px solid color-mix(in oklab, var(--ink) 10%, transparent);
	}
	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(0.75rem);
		}
	}
	.shelf a {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
		padding: 0.45em 0;
		color: inherit;
		text-decoration: none;
		font-family: var(--font);
		font-weight: var(--thought-weight);
		font-style: var(--thought-style);
		letter-spacing: var(--thought-tracking);
		font-size: clamp(1.9rem, 6.5vw, 3.4rem);
		line-height: 1.08;
		transition: color 0.25s var(--ease);
	}
	.shelf .title {
		min-width: 0;
		overflow-wrap: anywhere;
		transition: translate 0.35s var(--ease);
	}
	/* The count rides beside the name, small, like a footnote mark. */
	.shelf .count {
		align-self: flex-start;
		margin-top: 0.35em;
		font-family: var(--ui-font);
		font-style: normal;
		font-size: 0.8rem;
		font-weight: 500;
		letter-spacing: 0;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}
	.shelf :global(svg) {
		align-self: center;
		flex: none;
		width: 1.5rem;
		height: 1.5rem;
		margin-inline-start: auto;
		opacity: 0;
		translate: -0.75rem 0;
		color: var(--accent);
		transition:
			opacity 0.25s var(--ease),
			translate 0.35s var(--ease);
	}
	.shelf :global(svg:dir(rtl)) {
		transform: scaleX(-1);
	}
	@media (hover: hover) {
		.shelf a:hover .title {
			translate: 0.4rem 0;
		}
		.shelf a:hover :global(svg) {
			opacity: 1;
			translate: 0 0;
		}
	}
	.shelf a:active {
		color: var(--accent);
	}
	.shelf a[aria-current='page'] {
		color: var(--accent);
	}
	.shelf a[aria-current='page'] :global(svg) {
		opacity: 1;
		translate: 0 0;
	}
	.side {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 1.75rem;
		animation: rise 0.6s var(--ease) 0.2s both;
	}
	section h2 {
		margin: 0 0 0.4rem;
		padding-inline-start: 0.9rem;
	}

	.status {
		margin-top: 0.5rem;
		padding-inline: 0.9rem;
	}

	@media (prefers-reduced-motion: reduce) {
		.menu[open],
		.shelf li,
		.side {
			animation: none;
		}
	}
</style>
