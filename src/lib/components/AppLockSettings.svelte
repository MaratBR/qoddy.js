<script lang="ts">
	// Account → Privacy → App lock: turn it on with a 6-digit passcode or a password,
	// change it, turn it off, or lock now. This device only; no account needed.
	import { library } from '#lib/client/library.svelte.ts';
	import { t } from '#lib/client/i18n.svelte.ts';
	import PasscodePad from './PasscodePad.svelte';

	let kind = $state<'pin' | 'password'>(library.appLock ?? 'pin');
	let secret = $state('');
	let repeat = $state('');
	let error = $state<{ message: string; field?: string } | null>(null);
	let done = $state<string | null>(null);
	let busy = $state(false);
	let editing = $state(false);

	const showForm = $derived(!library.appLock || editing);

	async function apply(value: string): Promise<boolean> {
		busy = true;
		try {
			const had = library.appLock !== null;
			await library.setAppLock(kind, value);
			secret = repeat = '';
			editing = false;
			done = had ? t.appLock.changed : t.appLock.on;
			return true;
		} catch (failure) {
			console.warn(failure);
			error = { message: t.appLock.failed };
			return false;
		} finally {
			busy = false;
		}
	}

	async function save(event: SubmitEvent) {
		event.preventDefault();
		error = null;
		done = null;
		if ([...secret].length < 8) {
			error = { message: t.appLock.tooShort, field: 'secret' };
			return;
		}
		if (secret !== repeat) {
			error = { message: t.appLock.mismatch, field: 'repeat' };
			return;
		}
		await apply(secret);
	}

	// A passcode is entered twice on the keypad, as on a phone; a mismatch starts over.
	let first = $state<string | null>(null);
	let pinMessage = $state<string | null>(null);
	async function pinEntered(code: string): Promise<boolean> {
		error = null;
		done = null;
		if (first === null) {
			first = code;
			pinMessage = null;
			return true;
		}
		if (code !== first) {
			first = null;
			pinMessage = t.appLock.mismatchRetry;
			return false;
		}
		first = null;
		const ok = await apply(code);
		if (ok) padOpen = false;
		return ok;
	}

	// The keypad comes up over everything, as a phone's does, only while a
	// passcode is being set; Cancel or Escape puts it away.
	let padOpen = $state(false);
	function closePad() {
		padOpen = false;
		first = pinMessage = null;
	}

	function choose(option: 'pin' | 'password') {
		kind = option;
		secret = repeat = '';
		first = pinMessage = null;
		error = null;
	}

	async function turnOff() {
		if (!confirm(t.appLock.turnOffConfirm)) return;
		busy = true;
		error = null;
		try {
			await library.removeAppLock();
			done = t.appLock.off;
			editing = false;
		} catch (failure) {
			console.warn(failure);
			error = { message: t.appLock.failed };
		} finally {
			busy = false;
		}
	}
</script>

<p>{library.appLock ? t.appLock.onInfo(library.appLock) : t.appLock.offer}</p>

{#if showForm}
	<div class="segmented kinds" role="radiogroup" aria-label={t.appLock.title}>
		{#each ['pin', 'password'] as const as option (option)}
			<button
				type="button"
				role="radio"
				aria-checked={kind === option}
				onclick={() => choose(option)}>{t.appLock.kinds[option]}</button
			>
		{/each}
	</div>
	{#if kind === 'pin'}
		<p class="hint">{t.appLock.weakHint} {t.appLock.forgetHint}</p>
		<button type="button" class="button pin" disabled={busy} onclick={() => (padOpen = true)}
			>{library.appLock ? t.appLock.change : t.appLock.setPasscode}</button
		>
	{:else}
		<form onsubmit={save}>
			<label class="field">
				<span>{t.common.password}</span>
				<input type="password" autocomplete="new-password" bind:value={secret} />
				{#if error?.field === 'secret'}<span class="error">{error.message}</span>{/if}
			</label>
			<label class="field">
				<span>{t.appLock.repeat}</span>
				<input type="password" autocomplete="new-password" bind:value={repeat} />
				{#if error?.field === 'repeat'}<span class="error">{error.message}</span>{/if}
			</label>
			<p class="hint">{t.appLock.forgetHint}</p>
			<button class="button" disabled={busy}
				>{busy ? t.appLock.working : library.appLock ? t.appLock.change : t.appLock.turnOn}</button
			>
		</form>
	{/if}
	{#if editing}
		<p>
			<button type="button" class="link" onclick={() => ((editing = false), choose(kind))}
				>{t.write.cancel}</button
			>
		</p>
	{/if}
{:else}
	<div class="row">
		<button class="button" onclick={() => library.lockApp()}>{t.appLock.lockNow}</button>
		<button class="link" disabled={busy} onclick={() => (editing = true)}>{t.appLock.change}</button
		>
		<button class="link" disabled={busy} onclick={turnOff}
			>{busy ? t.appLock.working : t.appLock.turnOff}</button
		>
	</div>
{/if}
{#if error && !error.field}<p class="error" role="alert">{error.message}</p>{/if}
{#if done}<p role="status">{done}</p>{/if}

{#if padOpen}
	<dialog
		class="passcode"
		aria-label={t.appLock.title}
		{@attach (dialog) => dialog.showModal()}
		onclose={closePad}
	>
		<PasscodePad
			title={first === null ? t.appLock.newPasscode : t.appLock.repeatPasscode}
			message={busy ? t.appLock.working : pinMessage}
			oncomplete={pinEntered}
		/>
		<button type="button" class="cancel" onclick={closePad}>{t.write.cancel}</button>
	</dialog>
{/if}

<style>
	.kinds {
		display: flex;
		margin-bottom: 1.25rem;
	}
	.pin {
		margin-top: 1rem;
	}
	/* The keypad's screen: the page's paper over everything, the pad in the middle. */
	.passcode {
		width: 100vw;
		height: 100dvh;
		max-width: none;
		max-height: none;
		margin: 0;
		padding: max(2rem, env(safe-area-inset-top)) 1.25rem max(2rem, env(safe-area-inset-bottom));
		border: 0;
		background: var(--paper);
		color: var(--ink);
	}
	.passcode[open] {
		display: grid;
		align-content: center;
		justify-items: center;
		gap: 2rem;
		animation: rise 0.35s var(--ease);
	}
	@keyframes rise {
		from {
			transform: translateY(1.5rem);
			opacity: 0;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.passcode[open] {
			animation: none;
		}
	}
	.cancel {
		appearance: none;
		background: none;
		border: 0;
		padding: 0.5rem 1rem;
		min-height: 2.75rem;
		font: inherit;
		font-family: var(--ui-font);
		color: var(--ink);
		cursor: pointer;
	}
	.row {
		display: flex;
		align-items: center;
		gap: 1rem 1.5rem;
		flex-wrap: wrap;
	}
</style>
