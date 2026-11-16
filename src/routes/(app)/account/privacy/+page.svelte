<script lang="ts">
	// Account → Privacy: the password that encrypts your thoughts in the
	// account (signed in), and the app lock on this device.
	import { library, LibraryError } from '#lib/client/library.svelte.ts';
	import { t } from '#lib/client/i18n.svelte.ts';
	import SettingsPage from '#lib/components/SettingsPage.svelte';
	import Unlock from '#lib/components/Unlock.svelte';
	import AppLockSettings from '#lib/components/AppLockSettings.svelte';

	type Failure = { message: string; field?: string } | null;

	let newPassword = $state('');
	let repeat = $state('');
	let lockError = $state<Failure>(null);
	let lockBusy = $state(false);
	let lockDone = $state<string | null>(null);

	async function changeLock(event: SubmitEvent | null, remove = false) {
		event?.preventDefault();
		lockError = null;
		lockDone = null;
		if (!remove && newPassword.length < 8) {
			lockError = { message: t.account.tooShort, field: 'new' };
			return;
		}
		if (!remove && newPassword !== repeat) {
			lockError = { message: t.account.mismatch, field: 'repeat' };
			return;
		}
		if (remove && !confirm(t.account.removeConfirm)) return;
		lockBusy = true;
		try {
			const had = Boolean(library.lock);
			await library.setLock(remove ? null : newPassword);
			newPassword = repeat = '';
			lockDone = remove ? t.account.removed : had ? t.account.changed : t.account.locked;
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
			<form onsubmit={(event) => changeLock(event)}>
				<!-- Lets password managers file the new password under this account. -->
				<input
					class="visually-hidden"
					autocomplete="username"
					value={library.me.email}
					readonly
					tabindex="-1"
					aria-hidden="true"
				/>
				<label class="field">
					<span>{library.lock ? t.account.newPassword : t.common.password}</span>
					<input type="password" autocomplete="new-password" bind:value={newPassword} />
					{#if lockError?.field === 'new'}<span class="error">{lockError.message}</span>{/if}
				</label>
				<label class="field">
					<span>{t.account.repeat}</span>
					<input type="password" autocomplete="new-password" bind:value={repeat} />
					{#if lockError?.field === 'repeat'}<span class="error">{lockError.message}</span>{/if}
				</label>
				{#if lockError && !lockError.field}<p class="error" role="alert">
						{lockError.message}
					</p>{/if}
				{#if lockDone}<p role="status">{lockDone}</p>{/if}
				<div class="row">
					<button class="button" disabled={lockBusy || !library.online}>
						{lockBusy
							? t.account.encrypting
							: library.lock
								? t.account.changePassword
								: t.account.lockWithPassword}
					</button>
					{#if library.lock}
						<button
							type="button"
							class="link"
							disabled={lockBusy || !library.online}
							onclick={() => changeLock(null, true)}>{t.account.removeLock}</button
						>
						<button type="button" class="link" onclick={() => library.lockDevice()}
							>{t.account.lockDevice}</button
						>
					{/if}
				</div>
				{#if !library.online}<p class="hint">{t.account.lockNeedsConnection}</p>{/if}
			</form>
		{/if}
	</section>

	<section>
		<h2 class="label">{t.appLock.title}</h2>
		<AppLockSettings />
	</section>
</SettingsPage>
