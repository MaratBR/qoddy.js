<script lang="ts">
	// One thought by its id: a public one, or one of yours (found on this device only).
	import { page } from '$app/state';
	import { library } from '#lib/client/library.svelte.ts';
	import { t } from '#lib/client/i18n.svelte.ts';
	import Thought from '#lib/components/Thought.svelte';
	import KeepButton from '#lib/components/KeepButton.svelte';
	import Unlock from '#lib/components/Unlock.svelte';
	import Icon from '#lib/components/Icon.svelte';

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
	{#if thought}<title>{thought.author ?? t.thought.untitled} · {library.settings.site_name}</title
		>{/if}
</svelte:head>

<main>
	{#if thought}
		<Thought {thought}>
			{#snippet actions()}
				{#if shared}
					<KeepButton thought={shared} />
					{#if canShare}
						<button
							class="icon"
							onclick={share}
							aria-label={t.thought.share}
							title={t.thought.share}><Icon name="share" /></button
						>
					{/if}
				{:else}
					<a class="icon" href="/write?id={id}" aria-label={t.common.edit} title={t.common.edit}
						><Icon name="edit" /></a
					>
				{/if}
			{/snippet}
		</Thought>
		<p class="from">
			{#if collection}
				{t.thought.fromCollection}
				<a href={collection.slug === 'default' ? '/' : `/c/${collection.slug}`}>{collection.name}</a
				>
			{:else}
				{t.thought.fromMine} <a href="/c/mine/all">{t.thought.yourThoughtsLink}</a>
			{/if}
		</p>
	{:else if library.locked && library.sealed > 0}
		<Unlock />
	{:else}
		<h1>{t.common.notOnDevice}</h1>
		<p>{library.online ? t.thought.gone : t.thought.goneOffline}</p>
		<p><a href="/">{t.common.backToToday}</a></p>
	{/if}
</main>

<style>
	main {
		flex: 1;
		display: grid;
		align-content: center;
		padding: clamp(1.5rem, 6vh, 4rem) clamp(1.25rem, 8vw, 7rem) 3rem;
	}
	.from {
		margin: 3rem 0 0;
		color: var(--muted);
	}
	@media (max-width: 40rem) {
		main {
			padding: 1rem 1.25rem 1.5rem;
		}
		.from {
			margin-top: 1.5rem;
		}
	}
</style>
