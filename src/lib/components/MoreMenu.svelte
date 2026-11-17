<script lang="ts">
	// A "⋯" button opening a short list of links: the WAI-ARIA menu button.
	// Arrow keys move through the open list, Escape closes it and returns focus.
	import { dismissable } from '#lib/client/dismiss.ts';
	import Icon, { type IconName } from './Icon.svelte';

	let {
		label,
		items
	}: {
		label: string;
		items: readonly { href: string; label: string; icon: IconName }[];
	} = $props();

	const id = $props.id();
	let open = $state(false);
	let button: HTMLButtonElement | undefined = $state();
	let list: HTMLUListElement | undefined = $state();

	const links = () => [...(list?.querySelectorAll<HTMLAnchorElement>('a') ?? [])];

	function show(at = 0) {
		open = true;
		requestAnimationFrame(() => links().at(at)?.focus());
	}

	function hide(refocus = false) {
		open = false;
		if (refocus) button?.focus();
	}

	function onbuttonkeydown(event: KeyboardEvent) {
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			show(event.key === 'ArrowDown' ? 0 : -1);
		}
	}

	function onlistkeydown(event: KeyboardEvent) {
		const all = links();
		const index = all.indexOf(document.activeElement as HTMLAnchorElement);
		let next: number;
		if (event.key === 'ArrowDown') next = (index + 1) % all.length;
		else if (event.key === 'ArrowUp') next = (index - 1 + all.length) % all.length;
		else if (event.key === 'Home') next = 0;
		else if (event.key === 'End') next = all.length - 1;
		else if (event.key === 'Escape') return void (event.preventDefault(), hide(true));
		else if (event.key === 'Tab') return hide();
		else return;
		event.preventDefault();
		all[next]?.focus();
	}
</script>

<div class="more" {@attach open && dismissable(() => hide())}>
	<button
		bind:this={button}
		class="icon"
		aria-label={label}
		title={label}
		aria-haspopup="menu"
		aria-expanded={open}
		aria-controls={id}
		onclick={() => (open ? hide() : show())}
		onkeydown={onbuttonkeydown}><Icon name="more" filled /></button
	>
	{#if open}
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<ul {id} class="list" role="menu" aria-label={label} bind:this={list} onkeydown={onlistkeydown}>
			{#each items as item (item.href)}
				<li role="none">
					<a role="menuitem" href={item.href} onclick={() => hide()}>
						<Icon name={item.icon} />
						<span>{item.label}</span>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.more {
		position: relative;
	}
	/* Opens upward: the button sits under the thought, near the page's foot. */
	.list {
		position: absolute;
		inset-block-end: calc(100% + 0.4rem);
		inset-inline-start: 50%;
		translate: -50% 0;
		z-index: 2;
		min-width: 13rem;
		margin: 0;
		padding: 0.35rem;
		list-style: none;
		border-radius: calc(var(--radius) + 6px);
		background: var(--paper);
		box-shadow:
			0 0 0 1px color-mix(in oklab, var(--ink) 10%, transparent),
			0 12px 32px -8px color-mix(in oklab, #000 30%, transparent);
		font-family: var(--ui-font);
		animation: pop 0.18s var(--ease);
	}
	@keyframes pop {
		from {
			opacity: 0;
			transform: translateY(0.35rem) scale(0.98);
		}
	}
	a {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		min-height: 2.75rem;
		padding: 0 0.8rem;
		border-radius: calc(var(--radius) + 3px);
		color: var(--ink);
		text-decoration: none;
		font-size: 0.95rem;
		white-space: nowrap;
	}
	a:hover,
	a:focus-visible {
		outline: none;
		background: color-mix(in oklab, var(--ink) 7%, transparent);
	}
	/* Labels borrowed from elsewhere ("all 14 thoughts") start a line here. */
	a span {
		display: inline-block;
	}
	a span::first-letter {
		text-transform: uppercase;
	}
	a :global(svg) {
		width: 1.15rem;
		height: 1.15rem;
		flex: none;
		color: var(--muted);
	}
	@media (prefers-reduced-motion: reduce) {
		.list {
			animation: none;
		}
	}
</style>
