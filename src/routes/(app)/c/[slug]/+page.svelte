<script lang="ts">
	import { page } from '$app/state';
	import { library } from '#lib/client/library.svelte.ts';
	import { t } from '#lib/client/i18n.svelte.ts';
	import DayView from '#lib/components/DayView.svelte';

	const slug = $derived(page.params.slug ?? '');
	const name = $derived(slug === 'mine' ? t.common.yourThoughts : library.collection(slug)?.name);
	const count = $derived.by(() => {
		if (slug === 'mine') return library.mine.length;
		const collection = library.collection(slug);
		return collection ? library.countIn(collection.id) : 0;
	});
</script>

<svelte:head>
	{#if name}<title>{name} · {library.settings.site_name}</title>{/if}
</svelte:head>

{#if name}
	<p class="source">
		{name}
		<a href="/c/{slug}/all"
			>{slug === 'mine' && library.locked && library.sealed > 0
				? t.collection.locked
				: t.collection.count(count)}</a
		>
	</p>
{/if}

{#key slug}
	<DayView {slug} />
{/key}

<style>
	.source {
		margin: 0;
		padding: 0 clamp(1.25rem, 8vw, 7rem);
		display: flex;
		gap: 1rem;
		align-items: baseline;
		font-weight: 600;
	}
	.source a {
		font-weight: 400;
		color: var(--muted);
		font-size: 0.95rem;
	}
</style>
