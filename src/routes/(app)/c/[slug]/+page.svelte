<script lang="ts">
	import { page } from '$app/state';
	import { library } from '#lib/client/library.svelte.ts';
	import DayView from '#lib/components/DayView.svelte';

	const slug = $derived(page.params.slug ?? '');
	const name = $derived(library.source(slug)?.name);
</script>

<svelte:head>
	{#if name}<title>{name} · {library.settings.site_name}</title>{/if}
</svelte:head>

{#key slug}
	<DayView {slug} />
{/key}
