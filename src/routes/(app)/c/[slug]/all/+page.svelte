<script lang="ts">
	// Every thought in a collection, newest first, searchable.
	import { page } from '$app/state';
	import { library } from '#lib/client/library.svelte.ts';
	import Unlock from '#lib/components/Unlock.svelte';

	const slug = $derived(page.params.slug ?? '');
	const mine = $derived(slug === 'mine');
	const collection = $derived(mine ? undefined : library.collection(slug));
	const name = $derived(mine ? 'Your thoughts' : collection?.name);
	const all = $derived(
		mine
			? [...library.mine].reverse()
			: collection
				? library.thoughtsIn(collection.id).reverse()
				: []
	);

	let search = $state('');
	const shown = $derived.by(() => {
		const words = search.trim().toLocaleLowerCase();
		if (!words) return all;
		return all.filter((thought) =>
			[thought.text, thought.author, thought.source].some((field) =>
				field?.toLocaleLowerCase().includes(words)
			)
		);
	});
</script>

<svelte:head>
	{#if name}<title>{name} · {library.settings.site_name}</title>{/if}
</svelte:head>

<main>
	{#if !name}
		<h1>Nothing here</h1>
		<p>There is no collection at this address.</p>
	{:else}
		<header>
			<h1>{name}</h1>
			{#if collection?.description}<p class="muted">{collection.description}</p>{/if}
			<p>
				<a href="/c/{slug}">Today’s thought</a>
				{#if mine}<a class="button" href="/write">Write a thought</a>{/if}
			</p>
		</header>

		{#if mine && library.locked && library.sealed > 0}
			<Unlock />
		{/if}

		{#if all.length > 6}
			<label class="field search">
				<span>Search</span>
				<input type="search" bind:value={search} placeholder="Words, an author, a source" />
			</label>
		{/if}

		{#if all.length === 0}
			<p class="muted">
				{mine ? 'You have not written or kept any thoughts yet.' : 'No thoughts here yet.'}
			</p>
		{:else if shown.length === 0}
			<p class="muted">Nothing matches “{search.trim()}”.</p>
		{/if}

		<ol class="list">
			{#each shown as thought (thought.id)}
				<li>
					<a href="/t/{thought.id}" lang={thought.lang} dir="auto">
						<span class="text">{thought.text}</span>
						{#if thought.author}<span class="by">{thought.author}</span>{/if}
					</a>
				</li>
			{/each}
		</ol>
	{/if}
</main>

<style>
	main {
		padding: clamp(1.5rem, 5vh, 3rem) clamp(1.25rem, 8vw, 7rem) 4rem;
		max-width: 52rem;
	}
	header p {
		display: flex;
		gap: 1.5rem;
		align-items: center;
		flex-wrap: wrap;
	}
	.search {
		max-width: 24rem;
	}
	.list {
		list-style: none;
		padding: 0;
		margin: 1.5rem 0 0;
	}
	.list li {
		border-top: 1px solid var(--rule);
	}
	.list a {
		display: grid;
		gap: 0.2rem;
		padding: 1rem 0;
		text-decoration: none;
	}
	.list a:hover .text {
		color: var(--accent);
	}
	.text {
		font-family: var(--font);
		font-size: 1.25rem;
		line-height: 1.35;
		display: -webkit-box;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.by {
		color: var(--muted);
		font-size: 0.95rem;
	}
</style>
