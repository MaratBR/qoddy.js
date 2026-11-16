<script lang="ts">
	// A six-digit passcode entered as on an iPhone: a row of dots that fill as
	// you type, a round keypad, Delete. When six digits are in, `oncomplete`
	// decides: false shakes the dots and starts over. Digits and Backspace on a
	// keyboard work too.
	import { t } from '#lib/client/i18n.svelte.ts';

	let {
		title,
		message = null,
		oncomplete
	}: {
		title: string;
		/** Said under the dots (a mismatch, a wrong code). */
		message?: string | null;
		oncomplete: (code: string) => Promise<boolean> | boolean;
	} = $props();

	const LENGTH = 6;
	const KEYS = [
		['1', ''],
		['2', 'ABC'],
		['3', 'DEF'],
		['4', 'GHI'],
		['5', 'JKL'],
		['6', 'MNO'],
		['7', 'PQRS'],
		['8', 'TUV'],
		['9', 'WXYZ']
	] as const;

	let code = $state('');
	let checking = $state(false);
	let shaking = $state(false);

	async function press(digit: string) {
		if (checking || code.length >= LENGTH) return;
		code += digit;
		if (code.length < LENGTH) return;
		checking = true;
		let ok = false;
		try {
			ok = await oncomplete(code);
		} finally {
			checking = false;
		}
		if (!ok) {
			shaking = true;
			navigator.vibrate?.(120);
			setTimeout(() => {
				shaking = false;
				code = '';
			}, 450);
		} else {
			code = '';
		}
	}

	function remove() {
		if (!checking) code = code.slice(0, -1);
	}

	function onkeydown(event: KeyboardEvent) {
		if (event.altKey || event.ctrlKey || event.metaKey) return;
		if (event.target instanceof HTMLElement && event.target.closest('input, textarea')) return;
		if (/^\d$/.test(event.key)) {
			event.preventDefault();
			void press(event.key);
		} else if (event.key === 'Backspace') {
			event.preventDefault();
			remove();
		}
	}
</script>

<svelte:window {onkeydown} />

<div class="pad">
	<p class="title">{title}</p>
	<div
		class="dots"
		class:shaking
		role="status"
		aria-label={t.appLock.digitsEntered(code.length, LENGTH)}
	>
		{#each { length: LENGTH }, index (index)}
			<span class:filled={index < code.length}></span>
		{/each}
	</div>
	<p class="message" aria-live="polite">{message ?? ''}</p>
	<div class="keys">
		{#each KEYS as [digit, letters] (digit)}
			<button type="button" class="key" disabled={checking} onclick={() => press(digit)}>
				<span class="digit">{digit}</span>
				<span class="letters" aria-hidden="true">{letters}</span>
			</button>
		{/each}
		<span></span>
		<button type="button" class="key" disabled={checking} onclick={() => press('0')}>
			<span class="digit">0</span>
		</button>
		<button
			type="button"
			class="delete"
			onclick={remove}
			disabled={checking || code.length === 0}
			class:gone={code.length === 0}>{t.appLock.delete}</button
		>
	</div>
</div>

<style>
	.pad {
		display: grid;
		justify-items: center;
		font-family: var(--ui-font);
		user-select: none;
		-webkit-user-select: none;
	}
	.title {
		margin: 0 0 1.25rem;
		font-size: 1.15rem;
	}
	.dots {
		display: flex;
		gap: 1.1rem;
	}
	.dots span {
		width: 0.8rem;
		height: 0.8rem;
		border-radius: 50%;
		box-shadow: inset 0 0 0 1.5px var(--ink);
		transition: background-color 0.12s ease;
	}
	.dots span.filled {
		background: var(--ink);
	}
	.shaking {
		animation: shake 0.45s cubic-bezier(0.36, 0.07, 0.19, 0.97);
	}
	@keyframes shake {
		10%,
		90% {
			translate: -2px 0;
		}
		20%,
		80% {
			translate: 4px 0;
		}
		30%,
		50%,
		70% {
			translate: -10px 0;
		}
		40%,
		60% {
			translate: 10px 0;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.shaking {
			animation: none;
		}
	}
	.message {
		min-height: 1.5em;
		margin: 0.9rem 0 1.25rem;
		font-size: 0.9rem;
		color: var(--muted);
		text-align: center;
	}
	.keys {
		display: grid;
		grid-template-columns: repeat(3, 4.75rem);
		gap: 1rem 1.5rem;
		align-items: center;
		justify-items: center;
	}
	.key {
		appearance: none;
		display: grid;
		place-content: center;
		width: 4.75rem;
		height: 4.75rem;
		min-height: 0;
		margin: 0;
		padding: 0;
		border: 0;
		border-radius: 50%;
		background: color-mix(in oklab, var(--ink) 10%, transparent);
		color: var(--ink);
		cursor: pointer;
		touch-action: manipulation;
		-webkit-tap-highlight-color: transparent;
		transition: background-color 0.35s ease;
	}
	/* Lights up at once when touched, fades back, as the phone's keys do. */
	.key:active {
		background: color-mix(in oklab, var(--ink) 32%, transparent);
		transition-duration: 0s;
	}
	.key:focus-visible {
		outline-offset: 3px;
	}
	.digit {
		font-size: 2.1rem;
		font-weight: 400;
		line-height: 1;
	}
	.letters {
		min-height: 0.75em;
		margin-top: 0.1rem;
		font-size: 0.62rem;
		font-weight: 600;
		letter-spacing: 0.18em;
		/* Keeps the digits on one line whether or not letters sit under them. */
		text-indent: 0.18em;
	}
	.delete {
		appearance: none;
		background: none;
		border: 0;
		padding: 0.5rem;
		min-height: 2.75rem;
		font: inherit;
		font-size: 1rem;
		color: var(--ink);
		cursor: pointer;
	}
	.delete.gone {
		visibility: hidden;
	}
	@media (max-height: 40rem) {
		.keys {
			grid-template-columns: repeat(3, 4rem);
			gap: 0.6rem 1.25rem;
		}
		.key {
			width: 4rem;
			height: 4rem;
		}
	}
</style>
