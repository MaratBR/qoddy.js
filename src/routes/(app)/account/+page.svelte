<script lang="ts">
	// Signing in and out, and locking your thoughts with a password.
	import { library, LibraryError } from '#lib/client/library.svelte.ts';
	import Unlock from '#lib/components/Unlock.svelte';
	import LanguagePicker from '#lib/components/LanguagePicker.svelte';
	import { i18n, t } from '#lib/client/i18n.svelte.ts';

	type Failure = { message: string; field?: string } | null;

	let creating = $state(false);
	let name = $state('');
	let email = $state('');
	let password = $state('');
	let error = $state<Failure>(null);
	let busy = $state(false);

	let newPassword = $state('');
	let repeat = $state('');
	let lockError = $state<Failure>(null);
	let lockBusy = $state(false);
	let lockDone = $state<string | null>(null);

	const failure = (thrown: unknown, fallback: string): Failure =>
		thrown instanceof LibraryError
			? { message: thrown.message, field: thrown.field }
			: { message: fallback };

	async function enter(event: SubmitEvent) {
		event.preventDefault();
		busy = true;
		error = null;
		try {
			if (creating) await library.signUp(name, email, password);
			else await library.signIn(email, password);
			password = '';
		} catch (thrown) {
			error = failure(thrown, t.errors.generic);
		} finally {
			busy = false;
		}
	}

	async function signOut() {
		const waiting = library.pending;
		if (waiting > 0 && !confirm(t.account.signOutConfirm(waiting))) {
			return;
		}
		try {
			await library.signOut();
		} catch (thrown) {
			error = failure(thrown, t.account.couldNotSignOut);
		}
	}

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
			lockError = failure(thrown, t.account.couldNotChangeLock);
		} finally {
			lockBusy = false;
		}
	}

	const synced = $derived(
		library.lastSync
			? new Date(library.lastSync).toLocaleString(i18n.locale, {
					dateStyle: 'medium',
					timeStyle: 'short'
				})
			: null
	);
</script>

<svelte:head>
	<title>{t.account.title} · {library.settings.site_name}</title>
</svelte:head>

<main>
	{#if library.me}
		<h1>{library.me.name}</h1>
		<p class="muted">
			{library.me.email}
			{#if synced}<br />{t.account.lastSynced(synced)}{/if}
		</p>
		<p><button class="link" onclick={signOut}>{t.account.signOut}</button></p>
		<p class="hint">{t.account.signOutHint}</p>

		<section>
			<h2>{t.account.lock}</h2>
			{#if library.lock && library.locked}
				<Unlock />
			{:else}
				<p>
					{library.lock ? t.account.lockedInfo : t.account.lockOffer}
				</p>
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
			<h2>{t.menu.language}</h2>
			<LanguagePicker />
			<p class="hint">{t.account.languageSaved}</p>
		</section>
	{:else}
		<h1>{creating ? t.account.createHeading : t.account.signIn}</h1>
		<p class="lede">
			{library.mine.length > 0 ? t.account.localLede(library.mine.length) : t.account.lede}
		</p>
		<form onsubmit={enter}>
			{#if creating}
				<label class="field">
					<span>{t.account.name}</span>
					<input autocomplete="name" required bind:value={name} />
					{#if error?.field === 'name'}<span class="error">{error.message}</span>{/if}
				</label>
			{/if}
			<label class="field">
				<span>{t.account.email}</span>
				<input type="email" autocomplete="email" required bind:value={email} />
				{#if error?.field === 'email'}<span class="error">{error.message}</span>{/if}
			</label>
			<label class="field">
				<span>{t.common.password}</span>
				<input
					type="password"
					autocomplete={creating ? 'new-password' : 'current-password'}
					required
					bind:value={password}
				/>
				{#if error?.field === 'password'}<span class="error">{error.message}</span>{/if}
			</label>
			{#if error && !['name', 'email', 'password'].includes(error.field ?? '')}
				<p class="error" role="alert">{error.message}</p>
			{/if}
			<div class="row">
				<button class="button" disabled={busy || !library.online}>
					{creating ? t.account.createButton : t.account.signIn}
				</button>
				{#if library.settings.allow_sign_up || creating}
					<button
						type="button"
						class="link"
						onclick={() => {
							creating = !creating;
							error = null;
						}}>{creating ? t.account.haveAccount : t.account.createHeading}</button
					>
				{/if}
			</div>
			{#if !library.online}<p class="hint">{t.account.signInNeedsConnection}</p>{/if}
		</form>
	{/if}
</main>

<style>
	main {
		padding: clamp(1.5rem, 5vh, 3rem) clamp(1.25rem, 8vw, 7rem) 4rem;
		max-width: 38rem;
	}
	.lede {
		margin-bottom: 2rem;
	}
	section {
		margin-top: 3rem;
		padding-top: 1.5rem;
		border-top: 1px solid var(--rule);
	}
	.row {
		display: flex;
		align-items: center;
		gap: 1rem 1.5rem;
		flex-wrap: wrap;
	}
	@media (max-width: 40rem) {
		.row .button {
			flex: 1 0 100%;
		}
	}
</style>
