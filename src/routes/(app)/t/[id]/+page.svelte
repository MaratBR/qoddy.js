<script lang="ts">
	// One thought by its id: a public one, or one of yours (found on this device only).
	import { page } from '$app/state';
	import { library } from '#lib/client/library.svelte.ts';
	import Thought from '#lib/components/Thought.svelte';
	import KeepButton from '#lib/components/KeepButton.svelte';
	import Unlock from '#lib/components/Unlock.svelte';

	const id = $derived(page.params.id ?? '');
	const shared = $derived(library.thoughts.get(id));
	const mine = $derived(library.mineById(id));
	const thought = $derived(shared ?? mine);
	const collection = $derived(
		shared && library.collections.find((c) => c.id === shared.collection_id)
	);
	const canShare = typeof navigator !== 'undefined' && 'share' in navigator;

	function share() {
		if (!thought) return;
		void navigator.share({ text: thought.text, url: location.href }).catch(() => undefined);
	}
</script>

<svelte:head>
	{#if thought}<title>{thought.author ?? 'A thought'} · {library.settings.site_name}</title>{/if}
</svelte:head>

<main>
	{#if thought}
		<Thought {thought}>
			{#snippet actions()}
				{#if shared}
					<KeepButton thought={shared} />
					{#if canShare}<button class="link" onclick={share}>Share</button>{/if}
				{:else}
					<a class="link" href="/write?id={id}">Edit</a>
				{/if}
			{/snippet}
		</Thought>
		<p class="from">
			{#if collection}
				From <a href={collection.slug === 'default' ? '/' : `/c/${collection.slug}`}
					>{collection.name}</a
				>
			{:else}
				From <a href="/c/mine/all">your thoughts</a>
			{/if}
		</p>
	{:else if library.locked && library.sealed > 0}
		<Unlock />
	{:else}
		<h1>Not on this device</h1>
		<p>
			{library.online
				? 'This thought does not exist, or it was deleted.'
				: 'This thought is not on this device. Connect once to fetch it.'}
		</p>
		<p><a href="/">Back to today</a></p>
	{/if}
</main>

<style>
	main {
		min-height: calc(100dvh - 3.75rem);
		display: grid;
		align-content: center;
		padding: clamp(1.5rem, 6vh, 4rem) clamp(1.25rem, 8vw, 7rem) 3rem;
	}
	.from {
		margin-top: 3rem;
		color: var(--muted);
	}
</style>
