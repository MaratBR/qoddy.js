<script lang="ts">
	// One page of the account's settings: a way back to Account, a heading,
	// then sections each under a small label.
	import type { Snippet } from 'svelte';
	import { library } from '#lib/client/library.svelte.ts';
	import { t } from '#lib/client/i18n.svelte.ts';

	let { title, children }: { title: string; children: Snippet } = $props();
</script>

<svelte:head>
	<title>{title} · {library.settings.site_name}</title>
</svelte:head>

<main>
	<p class="back"><a class="link" href="/account">← {t.account.title}</a></p>
	<h1>{title}</h1>
	{@render children()}
</main>

<style>
	main {
		padding: clamp(1.5rem, 5vh, 3rem) clamp(1.25rem, 8vw, 7rem) 4rem;
		max-width: 38rem;
	}
	.back {
		margin: 0 0 0.5rem;
	}
	main :global(section) {
		margin-top: 2.25rem;
	}
	main :global(section > h2) {
		margin: 0 0 0.6rem;
	}
	main :global(section > p:not(.hint)) {
		margin-top: 0;
	}
	main :global(.row) {
		display: flex;
		align-items: center;
		gap: 1rem 1.5rem;
		flex-wrap: wrap;
	}
	@media (max-width: 40rem) {
		main :global(.row .button) {
			flex: 1 0 100%;
		}
	}
</style>
