<script lang="ts">
	// Account → Privacy: encrypting your thoughts in the account with your
	// account password (signed in), and the app lock on this device.
	import { library, LibraryError } from '#lib/client/library.svelte.ts';
	import { t } from '#lib/client/i18n.svelte.ts';
	import SettingsPage from '#lib/components/SettingsPage.svelte';
	import Unlock from '#lib/components/Unlock.svelte';
	import AppLockSettings from '#lib/components/AppLockSettings.svelte';

	type Failure = { message: string; field?: string } | null;

	let password = $state('');
	let lockError = $state<Failure>(null);
	let lockBusy = $state(false);
	let lockDone = $state<string | null>(null);

	/** Encrypts with the account password (again, when already on), or turns encryption off. */
	async function changeLock(event: SubmitEvent | null, remove = false) {
		event?.preventDefault();
		lockError = null;
		lockDone = null;
		if (remove && !confirm(t.account.removeConfirm)) return;
		lockBusy = true;
		try {
			const had = Boolean(library.lock);
			await library.setLock(remove ? null : password);
			password = '';
			lockDone = remove ? t.account.removed : had ? t.account.rekeyed : t.account.locked;
		} catch (thrown) {
			lockError =
				thrown instanceof LibraryError
					? { message: thrown.message, field: thrown.field }
					: { message: t.account.couldNotChangeLock };
		} finally {
			lockBusy = false;
		}
	}
</script>

<SettingsPage title={t.account.privacy}>
	<section>
		<h2 class="label">{t.account.lock}</h2>
		{#if !library.me}
			<p class="hint">{t.account.lockNeedsAccount}</p>
		{:else if library.lock && library.locked}
			<Unlock />
		{:else}
			<p>{library.lock ? t.account.lockedInfo : t.account.lockOffer}</p>
			{#snippet passwordForm(button: string)}
				<form onsubmit={(event) => changeLock(event)}>
					<!-- Lets password managers offer this account's password. -->
					<input
						class="visually-hidden"
						autocomplete="username"
						value={library.me?.email}
						readonly
						tabindex="-1"
						aria-hidden="true"
					/>
					<label class="field">
						<span>{t.account.accountPassword}</span>
						<input type="password" autocomplete="current-password" required bind:value={password} />
						{#if lockError?.field === 'password'}<span class="error">{lockError.message}</span>{/if}
					</label>
					<button class="button" disabled={lockBusy || !library.online}>
						{lockBusy ? t.account.encrypting : button}
					</button>
				</form>
			{/snippet}
			{#if library.lock}
				<div class="row">
					<button
						type="button"
						class="link"
						disabled={lockBusy || !library.online}
						onclick={() => changeLock(null, true)}>{t.account.removeLock}</button
					>
					<button type="button" class="link" onclick={() => library.lockDevice()}
						>{t.account.lockDevice}</button
					>
				</div>
				<details class="rekey">
					<summary class="link">{t.account.rekeyQuestion}</summary>
					<p class="hint">{t.account.rekeyHint}</p>
					{@render passwordForm(t.account.rekey)}
				</details>
			{:else}
				{@render passwordForm(t.account.lockWithPassword)}
			{/if}
			{#if lockError && lockError.field !== 'password'}<p class="error" role="alert">
					{lockError.message}
				</p>{/if}
			{#if lockDone}<p role="status">{lockDone}</p>{/if}
			{#if !library.online}<p class="hint">{t.account.lockNeedsConnection}</p>{/if}
		{/if}
	</section>

	<section>
		<h2 class="label">{t.appLock.title}</h2>
		<AppLockSettings />
	</section>
</SettingsPage>

<style>
	.rekey {
		margin-top: 1rem;
		max-width: 26rem;
	}
	.rekey[open] > summary {
		margin-bottom: 0.25rem;
	}
	.rekey > .hint {
		margin: 0 0 1rem;
	}
	summary {
		list-style: none;
	}
	summary::-webkit-details-marker {
		display: none;
	}
	/* A chevron that turns down when open, so the line reads as something that unfolds. */
	summary::after {
		content: '';
		width: 0.4em;
		height: 0.4em;
		border-right: 2px solid currentColor;
		border-bottom: 2px solid currentColor;
		transform: rotate(-45deg);
		transition: transform 0.2s var(--ease);
	}
	.rekey[open] > summary::after {
		transform: translateY(-0.15em) rotate(45deg);
	}
	@media (prefers-reduced-motion: reduce) {
		summary::after {
			transition: none;
		}
	}
</style>
