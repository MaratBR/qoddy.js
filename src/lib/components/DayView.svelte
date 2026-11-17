<script lang="ts">
	// The thought of the day from one source (a public collection, Your thoughts,
	// or another of your collections), with a way back through the last week:
	// arrows, ← → keys, and swipes.
	// Later days stay hidden: tomorrow's thought waits for tomorrow. The thought's
	// notes are the screen below.
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { library } from '#lib/client/library.svelte.ts';
	import { i18n, t } from '#lib/client/i18n.svelte.ts';
	import { addDays, formatDate, isDate, ofTheDay, today } from '#lib/days.ts';
	import type { MyThought } from '#lib/client/library.svelte.ts';
	import type { PublicThought } from '#lib/wire.ts';
	import Thought from './Thought.svelte';
	import Notes from './Notes.svelte';
	import Unlock from './Unlock.svelte';
	import KeepButton from './KeepButton.svelte';
	import ShareImageButton from './ShareImageButton.svelte';
	import MoreMenu from './MoreMenu.svelte';
	import Icon from './Icon.svelte';

	let { slug }: { slug: string } = $props();
	let notesView: Notes | undefined = $state();

	const now = today();
	const source = $derived(library.source(slug));
	const mine = $derived(source?.mine ?? false);
	const locked = $derived(mine && library.locked && library.sealed > 0);
	const thoughts = $derived<readonly (MyThought | PublicThought)[]>(source?.thoughts ?? []);
	/** The day a thought joined this source; '' for always. */
	const since = (thought: MyThought | PublicThought) =>
		thought.added ? today(new Date(thought.added)) : '';
	/** The furthest back a reader can go: a week, and not before the first thought. */
	const earliest = $derived.by(() => {
		const first = thoughts.map(since).reduce((min, day) => (day < min ? day : min), now);
		const week = addDays(now, -6);
		return first > week ? first : week;
	});
	const date = $derived.by(() => {
		const asked = page.url.searchParams.get('d') ?? '';
		return isDate(asked) && asked >= earliest && asked < now ? asked : now;
	});
	const daily = $derived(ofTheDay(thoughts, date, since));
	/** A thought picked at random (`?t=<id>`), shown instead of the day's. */
	const asked = $derived(page.url.searchParams.get('t') ?? '');
	const thought = $derived(thoughts.find((other) => other.id === asked) ?? daily);
	/** A public thought, which can be kept. */
	const shared = $derived(thought && !mine ? (thought as PublicThought) : undefined);
	/** Showing a random thought, not the day's: the arrows give way to a way back. */
	const picked = $derived(!!thought && thought.id !== daily?.id);
	const notes = $derived(locked || !source ? null : thought?.notes);
	const count = $derived(thoughts.length);
	const base = $derived(page.url.pathname);
	const focus = $derived(library.focus);

	/** Shows another thought from the same source, never the one already on the page. */
	function shuffle() {
		const others = thoughts.filter((other) => other.id !== thought?.id);
		const next = others[Math.floor(Math.random() * others.length)];
		if (next) void goto(`${base}?t=${next.id}`, { reset: false, replace: true });
	}

	const more = $derived(
		thought
			? [
					...(mine
						? [{ href: `/write?id=${thought.id}`, label: t.common.edit, icon: 'edit' as const }]
						: []),
					{ href: `/t/${thought.id}`, label: t.day.permalink, icon: 'link' as const },
					{ href: `/c/${slug}/all`, label: t.collection.count(count), icon: 'list' as const }
				]
			: []
	);

	// A double click (or tap) on the thought shows another, where the reader
	// turned it on. Not on controls, and not twice for one gesture.
	const interactive = (target: EventTarget | null) =>
		target instanceof Element && !!target.closest('a, button, input, textarea, .actions, footer');
	let shuffledAt = 0;
	function again(event: Event) {
		if (!library.doubleClickRandom || count < 2 || interactive(event.target)) return;
		if (Date.now() - shuffledAt < 500) return;
		shuffledAt = Date.now();
		getSelection()?.removeAllRanges();
		shuffle();
	}
	/** Keeps a double click from selecting a word first. */
	function onmousedown(event: MouseEvent) {
		if (library.doubleClickRandom && event.detail > 1 && !interactive(event.target)) {
			event.preventDefault();
		}
	}
	let tap: { at: number; x: number; y: number } | null = null;
	function onpointerup(event: PointerEvent) {
		if (event.pointerType !== 'touch') return;
		const last = tap;
		tap = { at: event.timeStamp, x: event.clientX, y: event.clientY };
		if (
			last &&
			event.timeStamp - last.at < 350 &&
			Math.hypot(event.clientX - last.x, event.clientY - last.y) < 30
		) {
			tap = null;
			again(event);
		}
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

<main {ontouchstart} {ontouchend} class:focus>
	<!-- The double click is an extra: the shuffle button does the same. -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="screen"
		class:again={library.doubleClickRandom}
		ondblclick={again}
		{onmousedown}
		{onpointerup}
	>
		{#if locked}
			<div>
				<p class="dateline-quiet">{dateline}</p>
				<Unlock />
			</div>
		{:else if !source}
			<div class="empty">
				<h1>{t.common.nothingHere}</h1>
				<p>{library.online ? t.common.noCollection : t.common.noCollectionOffline}</p>
				<p><a href="/">{t.common.backToToday}</a></p>
			</div>
		{:else if !thought}
			<div class="empty">
				{#if mine}
					<h1>{source.name}</h1>
					<p>{t.day.mineIntro}</p>
					<p><a class="button" href="/write?c={slug}">{t.common.writeAThought}</a></p>
					<p class="muted">{t.day.keepHint}</p>
				{:else}
					<h1>{source.name}</h1>
					<p>{t.common.noThoughtsYet}</p>
				{/if}
			</div>
		{:else}
			<!-- Someone else's collection is named; your own need no label. -->
			<Thought
				{thought}
				dateline={picked ? undefined : dateline}
				source={mine ? undefined : source.name}
			/>
			<!-- Out of the thought, above the footer: the buttons stay put as thoughts
			     of any length come and go. Shuffle leads, so it is always in one place.
			     In focus mode only the menu and the notes stay, muted. -->
			<div class="actions">
				{#if count > 1 && !focus}
					<button class="icon" onclick={shuffle} aria-label={t.day.random} title={t.day.random}
						><Icon name="shuffle" /></button
					>
				{/if}
				{#if shared && !focus}
					<KeepButton thought={shared} />
				{/if}
				{#if !focus}
					<ShareImageButton {thought} />
				{/if}
				<MoreMenu label={t.day.more} items={more} />
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
						class="icon day"
						href={href(addDays(date, -1))}
						aria-label={t.day.previous}
						title={t.day.previous}
						data-sveltekit-reset="false"><Icon name="previous" /></a
					>
				{:else}
					<span class="icon day" aria-hidden="true"></span>
				{/if}
				{#if date < now}
					{@const next = addDays(date, 1) === now ? t.menu.today : t.day.next}
					<a
						class="icon day"
						href={href(addDays(date, 1))}
						aria-label={next}
						title={next}
						data-sveltekit-reset="false"><Icon name="next" /></a
					>
				{:else}
					<span class="icon day" aria-hidden="true"></span>
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
	/* In place of the arrows, as tall, so nothing above them moves; the whole
	   row is its room, so a longer language's words stay on one line. */
	.back {
		flex: 1;
		align-self: center;
		color: var(--muted);
		font-size: 0.9rem;
		text-align: center;
	}
	footer {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 1.5rem 0 max(1rem, env(safe-area-inset-bottom));
	}
	/* Room below the arrows for the chevron that hints at notes (Notes.svelte), kept
	   on every page, so the arrows and buttons stand still with or without notes. */
	@media (any-pointer: coarse) {
		footer {
			padding-bottom: max(2.25rem, env(safe-area-inset-bottom) + 1.25rem);
		}
	}
	/* The way through the days: larger than the buttons above. */
	.day {
		width: 3.25rem;
		height: 3.25rem;
	}
	.day :global(svg) {
		width: 1.6rem;
		height: 1.6rem;
	}
	/* Double click for another: no word selected, no zoom on a double tap. */
	.again {
		touch-action: manipulation;
	}
	/* Focus mode: what is left of the controls recedes until wanted. */
	.focus :is(.actions, footer) :global(.icon) {
		background: none;
		color: var(--muted);
		opacity: 0.55;
		transition: opacity 0.25s var(--ease);
	}
	.focus :is(.actions, footer) :global(.icon:is(:hover, :focus-visible, [aria-expanded='true'])) {
		opacity: 1;
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
