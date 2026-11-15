<script lang="ts">
	// The thought of the day from one source (a public collection, or `mine`),
	// with a way back through the last week: ticks, links, ← → keys, and swipes.
	// Later days stay hidden: tomorrow's thought waits for tomorrow.
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { library } from '#lib/client/library.svelte.ts';
	import { addDays, formatDate, isDate, ofTheDay, today } from '#lib/days.ts';
	import Thought from './Thought.svelte';
	import Unlock from './Unlock.svelte';
	import KeepButton from './KeepButton.svelte';

	let { slug }: { slug: string } = $props();

	const now = today();
	/** The ticks: a fixed run ending two (unreachable) days after today. */
	const ticks = Array.from({ length: 9 }, (_, i) => addDays(now, i - 6));
	/** The furthest back a reader can go: the first tick. */
	const earliest = ticks[0];
	const date = $derived.by(() => {
		const asked = page.url.searchParams.get('d') ?? '';
		return isDate(asked) && asked >= earliest && asked < now ? asked : now;
	});
	const mine = $derived(slug === 'mine');
	const collection = $derived(mine ? undefined : library.collection(slug));
	const own = $derived(mine ? ofTheDay(library.mine, date) : undefined);
	const shared = $derived(
		collection ? ofTheDay(library.thoughtsIn(collection.id), date) : undefined
	);
	const thought = $derived(own ?? shared);
	const base = $derived(page.url.pathname);

	const href = (day: string) => (day === now ? base : `${base}?d=${day}`);
	const label = (day: string) =>
		formatDate(day, { weekday: 'long', day: 'numeric', month: 'long' });
	const dateline = $derived(
		date === now
			? label(date)
			: label(date) + (date.slice(0, 4) === now.slice(0, 4) ? '' : `, ${date.slice(0, 4)}`)
	);
	function go(days: number) {
		const day = addDays(date, days);
		if (day >= earliest && day <= now) void goto(href(day), { reset: false });
	}

	function onkeydown(event: KeyboardEvent) {
		if (
			event.target instanceof HTMLElement &&
			event.target.closest('input, textarea, select, dialog')
		)
			return;
		if (event.altKey || event.ctrlKey || event.metaKey) return;
		if (event.key === 'ArrowLeft') go(-1);
		if (event.key === 'ArrowRight') go(1);
	}

	let touch: { x: number; y: number } | null = null;
	function ontouchstart(event: TouchEvent) {
		touch = { x: event.touches[0].clientX, y: event.touches[0].clientY };
	}
	function ontouchend(event: TouchEvent) {
		if (!touch) return;
		const dx = event.changedTouches[0].clientX - touch.x;
		const dy = event.changedTouches[0].clientY - touch.y;
		touch = null;
		if (Math.abs(dx) > 60 && Math.abs(dx) > 2 * Math.abs(dy)) go(dx > 0 ? -1 : 1);
	}
</script>

<svelte:window {onkeydown} />

<main {ontouchstart} {ontouchend}>
	{#if mine && library.locked && library.sealed > 0}
		<div>
			<p class="dateline-quiet">{dateline}</p>
			<Unlock />
		</div>
	{:else if !mine && !collection}
		<div class="empty">
			<h1>Nothing here</h1>
			<p>
				There is no collection at this address{library.online
					? '.'
					: ' on this device yet. Connect once to fetch it.'}
			</p>
			<p><a href="/">Back to today</a></p>
		</div>
	{:else if !thought}
		<div class="empty">
			{#if mine}
				<h1>Your thoughts</h1>
				<p>
					Write down a thought you want to come back to. Each day brings one of yours back, the way
					this page shows one from the collection.
				</p>
				<p><a class="button" href="/write">Write a thought</a></p>
				<p class="muted">Or keep thoughts you meet: “Keep” under any of them adds it here.</p>
			{:else}
				<h1>{collection?.name}</h1>
				<p>No thoughts here yet.</p>
			{/if}
		</div>
	{:else}
		<Thought {thought} {dateline}>
			{#snippet actions()}
				{#if mine}
					<a class="link" href="/write?id={thought.id}">Edit</a>
				{:else if shared}
					<KeepButton thought={shared} />
				{/if}
				<a class="link" href="/t/{thought.id}">Permalink</a>
			{/snippet}
		</Thought>
	{/if}

	<footer>
		{#if date > earliest}
			<a class="link" href={href(addDays(date, -1))} data-sveltekit-reset="false">Previous day</a>
		{:else}
			<span class="link" aria-hidden="true"></span>
		{/if}
		<ol class="ticks" aria-label="Days">
			{#each ticks as day (day)}
				<li>
					{#if day <= now}
						<a
							href={href(day)}
							aria-label={label(day)}
							aria-current={day === date ? 'date' : undefined}
							class:today={day === now}
							data-sveltekit-reset="false"
						></a>
					{:else}
						<span aria-hidden="true"></span>
					{/if}
				</li>
			{/each}
		</ol>
		{#if date < now}
			<a class="link" href={href(addDays(date, 1))} data-sveltekit-reset="false"
				>{addDays(date, 1) === now ? 'Today' : 'Next day'}</a
			>
		{:else}
			<span class="link" aria-hidden="true"></span>
		{/if}
	</footer>
</main>

<style>
	main {
		min-height: calc(100dvh - 3.75rem);
		display: grid;
		grid-template-rows: 1fr auto;
		padding: clamp(1.5rem, 6vh, 4rem) clamp(1.25rem, 8vw, 7rem) 0;
	}
	/* The thought (a child component) sits in the middle of the free space. */
	main > :global(:first-child) {
		align-self: center;
	}
	.empty {
		max-width: 32rem;
	}
	.dateline-quiet {
		font-style: var(--date-style);
		color: var(--muted);
	}
	footer {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: 1rem;
		padding: 2.5rem 0 max(1rem, env(safe-area-inset-bottom));
	}
	footer > :last-child {
		justify-self: end;
	}
	footer .link {
		text-decoration: none;
		color: var(--muted);
	}
	footer .link:hover {
		color: var(--ink);
	}
	.ticks {
		list-style: none;
		display: flex;
		align-items: flex-end;
		gap: 0;
		margin: 0;
		padding: 0;
		height: 2.75rem;
	}
	.ticks a,
	.ticks span {
		display: flex;
		align-items: flex-end;
		justify-content: center;
		width: 1.1rem;
		height: 2.75rem;
	}
	.ticks a::after,
	.ticks span::after {
		content: '';
		width: 1px;
		height: 0.8rem;
		background: var(--muted);
		transition: height 0.2s ease;
	}
	.ticks span::after {
		opacity: 0.35;
	}
	.ticks a.today::after {
		height: 1.25rem;
	}
	.ticks a:hover::after {
		height: 1.5rem;
	}
	.ticks a[aria-current='date']::after {
		width: 3px;
		height: 1.75rem;
		background: var(--accent);
	}
	@media (max-width: 40rem) {
		footer {
			grid-template-columns: 1fr 1fr;
		}
		.ticks {
			grid-row: 1;
			grid-column: 1 / -1;
			justify-self: center;
		}
	}
</style>
