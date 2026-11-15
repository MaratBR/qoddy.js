<script lang="ts">
	// The thought of the day from one source (a public collection, or `mine`),
	// with a way back through the last week: ticks, links, ← → keys, and swipes.
	// Later days stay hidden: tomorrow's thought waits for tomorrow.
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { library } from '#lib/client/library.svelte.ts';
	import { i18n, t } from '#lib/client/i18n.svelte.ts';
	import { addDays, formatDate, isDate, ofTheDay, today } from '#lib/days.ts';
	import Thought from './Thought.svelte';
	import Unlock from './Unlock.svelte';
	import KeepButton from './KeepButton.svelte';
	import Icon from './Icon.svelte';

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
	/** One of yours picked at random (`?t=<id>`), shown instead of the day's. */
	const picked = $derived(
		mine ? library.mineById(page.url.searchParams.get('t') ?? '') : undefined
	);
	const own = $derived(mine ? (picked ?? ofTheDay(library.mine, date)) : undefined);
	const shared = $derived(
		collection ? ofTheDay(library.thoughtsIn(collection.id), date) : undefined
	);
	const thought = $derived(own ?? shared);
	const count = $derived(
		mine ? library.mine.length : collection ? library.countIn(collection.id) : 0
	);
	const base = $derived(page.url.pathname);

	/** Shows another of your thoughts, never the one already on the page. */
	function shuffle() {
		const others = library.mine.filter((other) => other.id !== thought?.id);
		const next = others[Math.floor(Math.random() * others.length)];
		if (next) void goto(`${base}?t=${next.id}`, { reset: false, replace: true });
	}

	const href = (day: string) => (day === now ? base : `${base}?d=${day}`);
	/** The date as the reader's language writes it, with the year only outside this one. */
	const label = (day: string) =>
		formatDate(
			day,
			{
				weekday: 'long',
				day: 'numeric',
				month: 'long',
				year: day.slice(0, 4) === now.slice(0, 4) ? undefined : 'numeric'
			},
			i18n.locale
		);
	const dateline = $derived(label(date));
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
			<h1>{t.common.nothingHere}</h1>
			<p>{library.online ? t.common.noCollection : t.common.noCollectionOffline}</p>
			<p><a href="/">{t.common.backToToday}</a></p>
		</div>
	{:else if !thought}
		<div class="empty">
			{#if mine}
				<h1>{t.common.yourThoughts}</h1>
				<p>{t.day.mineIntro}</p>
				<p><a class="button" href="/write">{t.common.writeAThought}</a></p>
				<p class="muted">{t.day.keepHint}</p>
			{:else}
				<h1>{collection?.name}</h1>
				<p>{t.common.noThoughtsYet}</p>
			{/if}
		</div>
	{:else}
		<!-- Someone else's collection is named; your own thoughts need no label. -->
		<Thought {thought} dateline={picked ? undefined : dateline} source={collection?.name}>
			{#snippet actions()}
				{#if mine}
					<a
						class="icon"
						href="/write?id={thought.id}"
						aria-label={t.common.edit}
						title={t.common.edit}><Icon name="edit" /></a
					>
					{#if count > 1}
						<button class="icon" onclick={shuffle} aria-label={t.day.random} title={t.day.random}
							><Icon name="shuffle" /></button
						>
					{/if}
				{:else if shared}
					<KeepButton thought={shared} />
				{/if}
				<a class="icon" href="/t/{thought.id}" aria-label={t.day.permalink} title={t.day.permalink}
					><Icon name="link" /></a
				>
				<a
					class="icon"
					href="/c/{slug}/all"
					aria-label={t.collection.count(count)}
					title={t.collection.count(count)}><Icon name="list" /></a
				>
			{/snippet}
		</Thought>
	{/if}

	<footer>
		{#if date > earliest}
			<a
				class="icon"
				href={href(addDays(date, -1))}
				aria-label={t.day.previous}
				title={t.day.previous}
				data-sveltekit-reset="false"><Icon name="previous" /></a
			>
		{:else}
			<span class="icon" aria-hidden="true"></span>
		{/if}
		<ol class="ticks" aria-label={t.day.days}>
			{#each ticks as day (day)}
				<li>
					{#if day <= now}
						<a
							href={href(day)}
							aria-label={label(day)}
							aria-current={day === date && !picked ? 'date' : undefined}
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
			{@const next = addDays(date, 1) === now ? t.menu.today : t.day.next}
			<a
				class="icon"
				href={href(addDays(date, 1))}
				aria-label={next}
				title={next}
				data-sveltekit-reset="false"><Icon name="next" /></a
			>
		{:else}
			<span class="icon" aria-hidden="true"></span>
		{/if}
	</footer>
</main>

<style>
	main {
		flex: 1;
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
		align-items: end;
		gap: 0.5rem;
		padding: 2.5rem 0 max(1rem, env(safe-area-inset-bottom));
	}
	/* Arrow glyphs line up with the text edges above them. */
	footer > .icon {
		align-items: flex-end;
	}
	footer > :first-child {
		margin-inline-start: -0.7rem;
	}
	footer > :last-child {
		justify-self: end;
		margin-inline-end: -0.7rem;
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
	/* Narrow screens: the thought gets the room. */
	@media (max-width: 40rem) {
		main {
			padding: 1rem 1.25rem 0;
		}
		footer {
			padding-top: 1.25rem;
		}
	}
</style>
