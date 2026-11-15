<script lang="ts">
	import { onMount } from 'svelte';
	import { page, updated } from '$app/state';
	import { afterNavigate } from '$app/navigation';
	import { library } from '#lib/client/library.svelte.ts';
	import { fontHref, look } from '#lib/client/look.svelte.ts';
	import { findTheme, THEMES } from '#lib/themes.ts';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
	let menu: HTMLDialogElement | undefined = $state();

	onMount(() => void library.init());

	// Close the menu on navigation; check for a new service worker meanwhile.
	afterNavigate(() => {
		menu?.close();
		void navigator.serviceWorker?.getRegistration().then((registration) => registration?.update());
	});

	const theme = $derived(findTheme(look.theme) ?? findTheme(library.theme) ?? THEMES[0]);
	const readerTheme = $derived(findTheme(library.theme) ?? THEMES[0]);

	$effect(() => {
		const root = document.documentElement;
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

	const chrome = $derived.by(() => {
		if (!theme.dark || library.mode === 'light') return theme.light;
		if (library.mode === 'dark') return theme.dark;
		return null;
	});

	const status = $derived.by(() => {
		if (!library.online) return 'Offline. You are reading what is on this device.';
		if (library.syncError) return library.syncError;
		if (library.signedIn && library.pending > 0) {
			return library.locked
				? `${library.pending} changes wait until you unlock your thoughts here.`
				: `${library.pending} changes waiting to sync.`;
		}
		if (library.signedIn) return 'Your thoughts are in sync.';
		return 'Your thoughts are kept on this device. Sign in to keep them in sync.';
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

<header class="bar">
	<a class="name" href="/">{library.settings.site_name}</a>
	{#if !library.online}<span class="offline">offline</span>{/if}
	<nav>
		<a class="link" href="/write" aria-current={current('/write')}>Write</a>
		<button class="link" onclick={() => menu?.showModal()} aria-haspopup="dialog">Menu</button>
	</nav>
</header>

{#if updated.current}
	<p class="update">
		A new version of {library.settings.site_name} is ready.
		<button class="link" onclick={() => location.reload()}>Reload</button>
	</p>
{/if}

{#if library.ready}
	{@render children()}
{/if}

<dialog
	bind:this={menu}
	class="sheet"
	aria-label="Menu"
	onclick={(event) => event.target === menu && menu.close()}
>
	<div class="sheet-body">
		<button class="link close" onclick={() => menu?.close()}>Close</button>

		<section>
			<h2 class="label">Read</h2>
			<ul class="places">
				{#if library.settings.daily}
					<li><a href="/" aria-current={current('/')}>Today</a></li>
				{/if}
				{#each library.collections.filter((c) => c.slug !== 'default' || !library.settings.daily) as collection (collection.id)}
					<li>
						<a href="/c/{collection.slug}" aria-current={current(`/c/${collection.slug}`)}
							>{collection.name}</a
						>
						<span class="count">{library.countIn(collection.id)}</span>
					</li>
				{/each}
				<li>
					<a href="/c/mine" aria-current={current('/c/mine')}>Your thoughts</a>
					<span class="count">{library.mine.length}</span>
				</li>
			</ul>
		</section>

		<section>
			<h2 class="label">Theme</h2>
			<div class="themes" role="radiogroup" aria-label="Theme">
				{#each THEMES as option (option.id)}
					<button
						role="radio"
						aria-checked={readerTheme.id === option.id}
						class="swatch"
						data-swatch={option.id}
						onclick={() => library.setTheme(option.id)}
					>
						<span class="sample" style:background={option.light}>Aa</span>
						{option.name}
					</button>
				{/each}
			</div>
			{#if readerTheme.dark}
				<div class="modes" role="radiogroup" aria-label="Light or dark">
					{#each [['System', null], ['Light', 'light'], ['Dark', 'dark']] as const as [label, value] (label)}
						<button
							role="radio"
							class="link"
							aria-checked={library.mode === value}
							onclick={() => library.setMode(value)}>{label}</button
						>
					{/each}
				</div>
			{/if}
			{#if look.theme && look.theme !== readerTheme.id}
				<p class="hint">This thought is set in its own theme.</p>
			{/if}
		</section>

		<section>
			<h2 class="label">Account</h2>
			<p class="status">{status}</p>
			<p>
				<a href="/account">{library.me ? library.me.name : 'Sign in or create an account'}</a>
			</p>
			{#if library.me?.role === 'admin'}
				<p><a href="/admin" data-sveltekit-reload>Dashboard</a></p>
			{/if}
		</section>
	</div>
</dialog>

<style>
	.bar {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: max(0.5rem, env(safe-area-inset-top)) clamp(1.25rem, 5vw, 3.5rem) 0.25rem;
		min-height: 3.5rem;
	}
	.name {
		font-weight: 600;
		text-decoration: none;
		letter-spacing: 0.01em;
	}
	.offline {
		font-style: italic;
		color: var(--muted);
		font-size: 0.9rem;
	}
	nav {
		margin-left: auto;
		display: flex;
		gap: 1.5rem;
	}
	nav .link {
		text-decoration: none;
	}
	nav .link[aria-current='page'] {
		color: var(--accent);
	}
	.update {
		margin: 0;
		padding: 0.25rem clamp(1.25rem, 5vw, 3.5rem);
		color: var(--muted);
		font-size: 0.95rem;
	}

	.sheet {
		margin: auto 0 0 auto;
		max-height: 100dvh;
		height: 100dvh;
		width: min(24rem, 100vw);
		max-width: 100vw;
		padding: 0;
		border: 0;
		background: var(--paper);
		color: var(--ink);
		box-shadow: var(--lift);
	}
	.sheet::backdrop {
		background: color-mix(in oklab, var(--ink) 25%, transparent);
	}
	.sheet[open] {
		animation: slide-in 0.25s cubic-bezier(0.2, 0.7, 0.2, 1);
	}
	@keyframes slide-in {
		from {
			transform: translateX(2rem);
			opacity: 0;
		}
	}
	.sheet-body {
		padding: max(1rem, env(safe-area-inset-top)) 1.75rem 2rem;
	}
	.close {
		display: flex;
		margin-left: auto;
	}
	section {
		margin-top: 1.5rem;
	}
	section h2 {
		font-size: 0.85rem;
		margin-bottom: 0.4rem;
	}
	.places {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.places li {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		border-bottom: 1px solid var(--rule);
	}
	.places a {
		display: block;
		flex: 1;
		padding: 0.6rem 0;
		font-size: 1.2rem;
		text-decoration: none;
	}
	.places a[aria-current='page'] {
		color: var(--accent);
	}
	.count {
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}
	.themes {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.6rem;
	}
	.swatch {
		appearance: none;
		background: none;
		border: 1px solid var(--rule);
		border-radius: var(--radius);
		padding: 0.5rem;
		display: grid;
		gap: 0.35rem;
		justify-items: start;
		cursor: pointer;
		font-size: 0.9rem;
		min-height: 2.75rem;
	}
	.swatch[aria-checked='true'] {
		border-color: var(--ink);
		box-shadow: inset 0 0 0 1px var(--ink);
	}
	.sample {
		display: block;
		width: 100%;
		border-radius: calc(var(--radius) / 2);
		padding: 0.2rem 0.4rem;
		font-size: 1.25rem;
		line-height: 1.3;
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
	.modes {
		display: flex;
		gap: 1.25rem;
		margin-top: 0.5rem;
	}
	.modes .link {
		text-decoration: none;
		color: var(--muted);
	}
	.modes .link[aria-checked='true'] {
		color: var(--ink);
		text-decoration: underline;
	}
	.status {
		color: var(--muted);
		font-size: 0.95rem;
	}

	@media (max-width: 40rem) {
		.sheet {
			width: 100vw;
			height: auto;
			max-height: 85dvh;
			margin: auto 0 0;
			border-radius: var(--radius) var(--radius) 0 0;
		}
		.sheet[open] {
			animation-name: slide-up;
		}
		.sheet-body {
			padding-bottom: max(2rem, env(safe-area-inset-bottom));
		}
		@keyframes slide-up {
			from {
				transform: translateY(2rem);
				opacity: 0;
			}
		}
	}
</style>
