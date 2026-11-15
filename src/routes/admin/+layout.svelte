<script lang="ts">
	import { page } from '$app/state';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const here = (path: string, exact = false) =>
		(exact ? page.url.pathname === path : page.url.pathname.startsWith(path)) ? 'page' : undefined;
</script>

<svelte:head>
	<title>Dashboard · {data.siteName}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="admin">
	<aside>
		<p class="site"><a href="/">{data.siteName}</a></p>
		<nav aria-label="Dashboard">
			<a
				href="/admin"
				aria-current={/^\/admin(\/[ct]\/.*)?$/.test(page.url.pathname) ? 'page' : undefined}
				>Collections</a
			>
			<a href="/admin/settings" aria-current={here('/admin/settings', true)}>Settings</a>
		</nav>
		<p class="who">Signed in as {data.user.name}</p>
	</aside>
	<main>
		{@render children()}
	</main>
</div>

<style>
	.admin {
		display: grid;
		grid-template-columns: 13rem 1fr;
		min-height: 100dvh;
	}
	aside {
		border-right: 1px solid var(--rule);
		padding: 1.5rem 1.5rem 2rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.site {
		font-weight: 600;
		margin: 0;
	}
	.site a {
		text-decoration: none;
	}
	nav {
		display: grid;
	}
	nav a {
		padding: 0.45rem 0;
		text-decoration: none;
		color: var(--muted);
	}
	nav a[aria-current='page'] {
		color: var(--ink);
		font-weight: 600;
	}
	.who {
		margin-top: auto;
		font-size: 0.85rem;
		color: var(--muted);
	}
	main {
		padding: 1.5rem clamp(1.25rem, 4vw, 3rem) 4rem;
		max-width: 64rem;
		min-width: 0;
	}
	@media (max-width: 48rem) {
		.admin {
			grid-template-columns: 1fr;
		}
		aside {
			border-right: 0;
			border-bottom: 1px solid var(--rule);
			flex-direction: row;
			flex-wrap: wrap;
			align-items: center;
			padding: 1rem 1.25rem;
		}
		nav {
			display: flex;
			gap: 1.25rem;
		}
		.who {
			display: none;
		}
	}
</style>
