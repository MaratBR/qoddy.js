<script lang="ts" generics="T extends string">
	// A pop-up list in place of the browser's <select>: the WAI-ARIA select-only
	// combobox. Focus stays on the button; the arrow keys move through the open
	// list, Enter or Space chooses, and typing jumps to an option by its label.
	import type { Snippet } from 'svelte';
	import { dismissable } from '#lib/client/dismiss.ts';
	import Icon from './Icon.svelte';

	let {
		value = $bindable(),
		options,
		labelledby,
		item
	}: {
		value: T;
		options: readonly { value: T; label: string }[];
		/** The id of the visible label. */
		labelledby: string;
		/** Drawn before an option's label, on the button and in the list. */
		item?: Snippet<[T]>;
	} = $props();

	const id = $props.id();
	let open = $state(false);
	/** The option the keys are on while the list is open. */
	let active = $state(0);
	/** Opens upward when there is no room below. */
	let above = $state(false);
	let combobox: HTMLDivElement | undefined = $state();
	let list: HTMLUListElement | undefined = $state();

	const selected = $derived(
		Math.max(
			0,
			options.findIndex((option) => option.value === value)
		)
	);

	function show(index = selected) {
		active = index;
		if (combobox) {
			// The list is hidden, so it cannot be measured; its rows are about the button's height.
			const rect = combobox.getBoundingClientRect();
			const height = Math.min(options.length * rect.height + 16, 0.6 * innerHeight);
			above = rect.bottom + height > innerHeight && rect.top > innerHeight - rect.bottom;
		}
		open = true;
	}

	function hide() {
		open = false;
	}

	function choose(index: number) {
		value = options[index].value;
		hide();
		combobox?.focus();
	}

	$effect(() => {
		if (open) list?.children[active]?.scrollIntoView({ block: 'nearest' });
	});

	// Typing a few letters in quick succession finds an option starting with them.
	let typed = '';
	let typedAt = 0;
	function find(key: string): number {
		const now = Date.now();
		typed = now - typedAt > 700 ? key : typed + key;
		typedAt = now;
		const prefix = typed.toLocaleLowerCase();
		const from = typed.length === 1 ? active + 1 : active;
		for (let step = 0; step < options.length; step++) {
			const index = (from + step) % options.length;
			if (options[index].label.toLocaleLowerCase().startsWith(prefix)) return index;
		}
		return -1;
	}

	function onkeydown(event: KeyboardEvent) {
		// Ctrl or ⌘ + Enter belongs to the form.
		if (event.ctrlKey || event.metaKey) return;
		const { key } = event;
		const last = options.length - 1;
		const typing = key.length === 1 && key !== ' ';

		if (!open) {
			if (key === 'ArrowDown' || key === 'ArrowUp' || key === 'Enter' || key === ' ') show();
			else if (key === 'Home') show(0);
			else if (key === 'End') show(last);
			else if (typing) {
				const index = find(key);
				show(index >= 0 ? index : selected);
			} else return;
			event.preventDefault();
			return;
		}

		if (key === 'ArrowDown') active = Math.min(active + 1, last);
		else if (key === 'ArrowUp' && event.altKey) choose(active);
		else if (key === 'ArrowUp') active = Math.max(active - 1, 0);
		else if (key === 'Home' || key === 'PageUp') active = 0;
		else if (key === 'End' || key === 'PageDown') active = last;
		else if (key === 'Enter' || key === ' ') choose(active);
		else if (key === 'Escape') hide();
		else if (key === 'Tab') {
			// Leaving with Tab keeps the option the keys were on, then moves on.
			value = options[active].value;
			hide();
			return;
		} else if (typing) {
			const index = find(key);
			if (index >= 0) active = index;
		} else return;
		event.preventDefault();
	}
</script>

<div class="select" {@attach open && dismissable(hide)}>
	<div
		bind:this={combobox}
		class="combobox"
		role="combobox"
		tabindex="0"
		aria-labelledby={labelledby}
		aria-controls="{id}-list"
		aria-expanded={open}
		aria-haspopup="listbox"
		aria-activedescendant={open ? `${id}-${active}` : undefined}
		onclick={() => (open ? hide() : show())}
		{onkeydown}
	>
		{@render item?.(options[selected].value)}
		<span class="text">{options[selected].label}</span>
		<Icon name="updown" />
	</div>
	<!-- Pressing in the list keeps focus on the combobox. -->
	<ul
		bind:this={list}
		id="{id}-list"
		class={{ above }}
		role="listbox"
		aria-labelledby={labelledby}
		tabindex="-1"
		hidden={!open}
		onpointerdown={(event) => event.preventDefault()}
	>
		{#each options as option, index (option.value)}
			<!-- svelte-ignore a11y_click_events_have_key_events (the combobox takes the keys) -->
			<li
				id="{id}-{index}"
				role="option"
				aria-selected={index === selected}
				class={{ active: index === active }}
				onpointermove={() => (active = index)}
				onclick={() => choose(index)}
			>
				{@render item?.(option.value)}
				<span class="text">{option.label}</span>
				<span class="tick"><Icon name="check" /></span>
			</li>
		{/each}
	</ul>
</div>

<style>
	.select {
		position: relative;
		font-family: var(--ui-font);
		font-size: 0.95rem;
	}

	/* Filled like the text fields beside it; the up-down chevron says it opens. */
	.combobox {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		min-height: 2.75rem;
		padding: 0.55em 0.7em 0.55em 0.8em;
		border: 1px solid transparent;
		border-radius: calc(var(--radius) + 2px);
		background: var(--wash);
		line-height: 1.4;
		cursor: pointer;
		user-select: none;
		transition:
			background-color 0.2s var(--ease),
			border-color 0.2s var(--ease),
			box-shadow 0.2s var(--ease);
	}
	@media (hover: hover) {
		.combobox:hover {
			background: color-mix(in oklab, var(--ink) 10%, var(--paper));
		}
	}
	.combobox:focus-visible,
	.combobox[aria-expanded='true'] {
		outline: none;
		border-color: color-mix(in oklab, var(--accent) 70%, transparent);
		box-shadow: 0 0 0 3px color-mix(in oklab, var(--accent) 22%, transparent);
	}
	.combobox .text {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.combobox :global(svg) {
		flex: none;
		width: 1.1rem;
		height: 1.1rem;
		color: var(--muted);
	}

	/* The list: a raised sheet just under the button (or over it), growing out of it. */
	ul {
		position: absolute;
		z-index: 2;
		inset-inline: 0;
		top: calc(100% + 0.35rem);
		min-width: max-content;
		max-height: min(20rem, 60vh);
		overflow-y: auto;
		margin: 0;
		padding: 0.3rem;
		list-style: none;
		border-radius: calc(var(--radius) + 6px);
		background: light-dark(
			color-mix(in oklab, var(--paper) 30%, #fff),
			color-mix(in oklab, var(--ink) 14%, var(--paper))
		);
		box-shadow:
			0 0 0 1px color-mix(in oklab, var(--ink) 10%, transparent),
			0 2px 4px color-mix(in oklab, #000 8%, transparent),
			var(--lift);
		transform-origin: top center;
		transition:
			opacity 0.18s var(--ease),
			scale 0.25s var(--ease),
			display 0.25s allow-discrete;
		@starting-style {
			opacity: 0;
			scale: 0.96;
		}
	}
	ul.above {
		top: auto;
		bottom: calc(100% + 0.35rem);
		transform-origin: bottom center;
	}
	ul[hidden] {
		display: none;
		opacity: 0;
		scale: 0.96;
	}

	li {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		min-height: 2.5rem;
		padding: 0.4em 0.6em;
		border-radius: calc(var(--radius) + 2px);
		cursor: pointer;
	}
	li.active {
		background: color-mix(in oklab, var(--accent) 13%, transparent);
	}
	li .text {
		flex: 1;
	}
	.tick {
		display: flex;
		color: var(--accent);
		visibility: hidden;
	}
	li[aria-selected='true'] .tick {
		visibility: visible;
	}
	.tick :global(svg) {
		width: 1.1rem;
		height: 1.1rem;
		stroke-width: 2;
	}
	@media (pointer: coarse) {
		li {
			min-height: 2.75rem;
		}
	}
</style>
