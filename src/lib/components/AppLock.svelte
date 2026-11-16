<script lang="ts">
	// The app lock's door: shown instead of the app until the passcode or
	// password opens this device's data. A forgotten one can only be got past
	// by erasing the device's data, after asking twice.
	import { library, LibraryError } from '#lib/client/library.svelte.ts';
	import { t } from '#lib/client/i18n.svelte.ts';
	import PasscodePad from './PasscodePad.svelte';

	const kind = $derived(library.appLock ?? 'password');
	let secret = $state('');
	let error = $state<string | null>(null);
	let busy = $state(false);
	let input: HTMLInputElement | undefined = $state();

	$effect(() => input?.focus());

	/** Tries a passcode or password; false when it is wrong. */
	async function attempt(value: string): Promise<boolean> {
		busy = true;
		error = null;
		try {
			await library.unlockApp(value);
			return true;
		} catch (failure) {
			error = failure instanceof LibraryError ? failure.message : t.unlock.failed;
			return false;
		} finally {
			busy = false;
		}
	}

	async function unlock(event: SubmitEvent) {
		event.preventDefault();
		if (busy || !secret) return;
		if (!(await attempt(secret))) {
			secret = '';
			input?.focus();
		}
	}

	async function erase() {
		if (!confirm(t.appLock.eraseConfirm) || !confirm(t.appLock.eraseConfirmAgain)) return;
		await library.eraseDevice();
	}
</script>

<main>
	{#if kind === 'pin'}
		<h1 class="visually-hidden">{t.appLock.prompt(library.settings.site_name)}</h1>
		<PasscodePad title={t.appLock.enterPasscode} message={error} oncomplete={attempt} />
	{:else}
		<form onsubmit={unlock}>
			<h1>{t.appLock.prompt(library.settings.site_name)}</h1>
			<label class="field">
				<span>{t.appLock.enter(kind)}</span>
				<input
					bind:this={input}
					bind:value={secret}
					type="password"
					autocomplete="current-password"
					aria-invalid={error ? true : undefined}
					disabled={busy}
				/>
				{#if error}<span class="error" role="alert">{error}</span>{/if}
			</label>
			<button class="button" disabled={busy}>{busy ? t.appLock.unlocking : t.appLock.unlock}</button
			>
		</form>
	{/if}
	<details>
		<summary class="link">{t.appLock.forgot}</summary>
		<p class="hint">{t.appLock.forgetHint}</p>
		<button type="button" class="button danger" onclick={erase}>{t.appLock.erase}</button>
	</details>
</main>

<style>
	main {
		flex: 1;
		display: grid;
		align-content: center;
		justify-items: center;
		gap: 3rem;
		padding: 2rem 1.25rem max(2rem, env(safe-area-inset-bottom));
		text-align: center;
	}
	form {
		display: grid;
		justify-items: center;
		gap: 1rem;
		width: min(20rem, 100%);
	}
	h1 {
		margin: 0 0 0.5rem;
	}
	.field {
		width: 100%;
	}
	details {
		max-width: 24rem;
	}
	summary {
		cursor: pointer;
		list-style: none;
	}
	summary::-webkit-details-marker {
		display: none;
	}
</style>
