<script lang="ts">
	// The thought of the day from one source (a public collection, or `mine`),
	// with a way back through the last week: ticks, links, ← → keys, and swipes.
	// Later days stay hidden: tomorrow's thought waits for tomorrow. The thought's
	// notes are the screen below.
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { library } from '#lib/client/library.svelte.ts';
	import { i18n, t } from '#lib/client/i18n.svelte.ts';
	import { addDays, formatDate, isDate, ofTheDay, today } from '#lib/days.ts';
	import Thought from './Thought.svelte';
	import Notes from './Notes.svelte';
	import Unlock from './Unlock.svelte';
	import KeepButton from './KeepButton.svelte';
	import ShareImageButton from './ShareImageButton.svelte';
	import Icon from './Icon.svelte';

	let { slug }: { slug: string } = $props();
	let notesView: Notes | undefined = $state();

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
	const locked = $derived(mine && library.locked && library.sealed > 0);
	const collection = $derived(mine ? undefined : library.collection(slug));
	const inCollection = $derived(collection ? library.thoughtsIn(collection.id) : []);
	const daily = $derived(
		mine ? ofTheDay(library.mine, date) : collection ? ofTheDay(inCollection, date) : undefined
	);
	/** A thought picked at random (`?t=<id>`), shown instead of the day's. */
	const asked = $derived(page.url.searchParams.get('t') ?? '');
	const own = $derived(
		mine ? (library.mineById(asked) ?? ofTheDay(library.mine, date)) : undefined
	);
	const shared = $derived(
		collection
			? (inCollection.find((other) => other.id === asked) ?? ofTheDay(inCollection, date))
			: undefined
	);
	const thought = $derived(own ?? shared);
	/** Showing a random thought, not the day's: the ticks give way to a way back. */
	const picked = $derived(!!thought && thought.id !== daily?.id);
	const notes = $derived(locked || (!mine && !collection) ? null : thought?.notes);
	const count = $derived(mine ? library.mine.length : inCollection.length);
	const base = $derived(page.url.pathname);

	/** Shows another thought from the same source, never the one already on the page. */
	function shuffle() {
		const others = (mine ? library.mine : inCollection).filter((other) => other.id !== thought?.id);
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
	<div class="screen">
		{#if locked}
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
			<Thought {thought} dateline={picked ? undefined : dateline} source={collection?.name} />
			<!-- Out of the thought, above the footer: the buttons stay put as thoughts
			     of any length come and go. Shuffle leads, so it is always in one place. -->
			<div class="actions">
				{#if count > 1}
					<button class="icon" onclick={shuffle} aria-label={t.day.random} title={t.day.random}
						><Icon name="shuffle" /></button
					>
				{/if}
				{#if mine}
					<a
						class="icon"
						href="/write?id={thought.id}"
						aria-label={t.common.edit}
						title={t.common.edit}><Icon name="edit" /></a
					>
				{:else if shared}
					<KeepButton thought={shared} />
				{/if}
				<a class="icon" href="/t/{thought.id}" aria-label={t.day.permalink} title={t.day.permalink}
					><Icon name="link" /></a
				>
				<ShareImageButton {thought} />
				<a
					class="icon"
					href="/c/{slug}/all"
					aria-label={t.collection.count(count)}
					title={t.collection.count(count)}><Icon name="list" /></a
				>
				<!-- Its place is kept for thoughts without notes, so the row never shifts. -->
				{#if notes}
					<button
						class="icon down"
						onclick={() => notesView?.show()}
						aria-label={t.thought.about}
						title={t.thought.about}><Icon name="down" /></button
					>
				{:else}
					<span class="icon down" aria-hidden="true"></span>
				{/if}
			</div>
		{/if}

		<footer>
			{#if picked}
				<a class="link back" href={base} data-sveltekit-reset="false">{t.common.backToToday}</a>
			{:else}
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
			{/if}
		</footer>
	</div>
	{#if thought && notes}
		{#key thought.id}
			<Notes bind:this={notesView} {notes} lang={thought.lang} />
		{/key}
	{/if}
</main>

<style>
	main {
		flex: 1;
	}
	.screen {
		display: grid;
		grid-template-rows: 1fr auto auto;
		padding: clamp(1.5rem, 6vh, 4rem) clamp(1.25rem, 8vw, 7rem) 0;
	}
	/* The thought (a child component) sits in the middle of the free space. */
	.screen > :global(:first-child) {
		align-self: center;
	}
	.empty {
		max-width: 32rem;
	}
	.dateline-quiet {
		font-style: var(--date-style);
		color: var(--muted);
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		padding-top: 1.5rem;
	}
	/* On touch, the notes are a scroll away (Notes.svelte hints at them). */
	@media (any-pointer: coarse) {
		.down {
			display: none;
		}
	}
	/* In place of the ticks and arrows, as tall, so nothing above them moves;
	   the whole row is its room, so a longer language's words stay on one line. */
	.back {
		grid-column: 1 / -1;
		justify-self: center;
		align-self: center;
		color: var(--muted);
		font-size: 0.9rem;
		text-align: center;
	}
	footer {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: end;
		gap: 0.5rem;
		padding: 1.5rem 0 max(1rem, env(safe-area-inset-bottom));
	}
	/* Room below the ticks for the chevron that hints at notes (Notes.svelte), kept
	   on every page, so the ticks and buttons stand still with or without notes. */
	@media (any-pointer: coarse) {
		footer {
			padding-bottom: max(2.25rem, env(safe-area-inset-bottom) + 1.25rem);
		}
	}
	footer > .icon:last-child {
		justify-self: end;
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
		width: 2px;
		height: 0.8rem;
		border-radius: 1px;
		background: color-mix(in oklab, var(--muted) 70%, transparent);
		transition:
			height 0.35s var(--ease),
			width 0.35s var(--ease),
			background-color 0.35s var(--ease);
	}
	.ticks span::after {
		opacity: 0.4;
	}
	.ticks a.today::after {
		height: 1.25rem;
	}
	@media (hover: hover) {
		.ticks a:hover::after {
			height: 1.5rem;
			background: var(--muted);
		}
	}
	/* Fingers need wider targets than a pointer. */
	@media (pointer: coarse) {
		.ticks a,
		.ticks span {
			width: 1.5rem;
		}
	}
	.ticks a:focus-visible {
		outline-offset: -2px;
		border-radius: 6px;
	}
	.ticks a[aria-current='date']::after {
		width: 4px;
		height: 1.75rem;
		border-radius: 2px;
		background: var(--accent);
	}
	/* Narrow screens: the thought gets the room. */
	@media (max-width: 40rem) {
		.screen {
			padding: 1rem 1.25rem 0;
		}
		footer {
			padding-top: 1.25rem;
		}
		.actions {
			justify-content: center;
		}
	}
</style>
