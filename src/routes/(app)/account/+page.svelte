<script lang="ts">
	// Signing in and out, and locking your thoughts with a password.
	import { library, LibraryError } from '#lib/client/library.svelte.ts';
	import Unlock from '#lib/components/Unlock.svelte';

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
			error = failure(thrown, 'Something went wrong. Try again.');
		} finally {
			busy = false;
		}
	}

	async function signOut() {
		const waiting = library.pending;
		if (
			waiting > 0 &&
			!confirm(
				`${waiting} of your changes have not reached the server yet and will be lost. Sign out anyway?`
			)
		) {
			return;
		}
		try {
			await library.signOut();
		} catch (thrown) {
			error = failure(thrown, 'Could not sign out.');
		}
	}

	async function changeLock(event: SubmitEvent | null, remove = false) {
		event?.preventDefault();
		lockError = null;
		lockDone = null;
		if (!remove && newPassword.length < 8) {
			lockError = { message: 'Use at least 8 characters.', field: 'new' };
			return;
		}
		if (!remove && newPassword !== repeat) {
			lockError = { message: 'The passwords do not match.', field: 'repeat' };
			return;
		}
		if (remove && !confirm('Remove the lock? Your thoughts will be stored unencrypted.')) return;
		lockBusy = true;
		try {
			const had = Boolean(library.lock);
			await library.setLock(remove ? null : newPassword);
			newPassword = repeat = '';
			lockDone = remove
				? 'The lock is removed.'
				: had
					? 'Password changed.'
					: 'Your thoughts are locked.';
		} catch (thrown) {
			lockError = failure(thrown, 'Could not change the lock.');
		} finally {
			lockBusy = false;
		}
	}

	const synced = $derived(
		library.lastSync
			? new Date(library.lastSync).toLocaleString(undefined, {
					dateStyle: 'medium',
					timeStyle: 'short'
				})
			: null
	);
</script>

<svelte:head>
	<title>Account · {library.settings.site_name}</title>
</svelte:head>

<main>
	{#if library.me}
		<h1>{library.me.name}</h1>
		<p class="muted">
			{library.me.email}
			{#if synced}<br />Last synced {synced}.{/if}
		</p>
		<p><button class="link" onclick={signOut}>Sign out</button></p>
		<p class="hint">
			Signing out removes your thoughts from this device. They stay in your account.
		</p>

		<section>
			<h2>Lock</h2>
			{#if library.lock && library.locked}
				<Unlock />
			{:else}
				<p>
					{#if library.lock}
						Your thoughts are encrypted on your devices before they are sent, with a key made from
						your password. The server cannot read them.
					{:else}
						Lock your thoughts with a password: they are encrypted on your devices before they are
						sent, and the server cannot read them. If you forget the password, nobody can recover
						them.
					{/if}
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
						<span>{library.lock ? 'New password' : 'Password'}</span>
						<input type="password" autocomplete="new-password" bind:value={newPassword} />
						{#if lockError?.field === 'new'}<span class="error">{lockError.message}</span>{/if}
					</label>
					<label class="field">
						<span>Repeat it</span>
						<input type="password" autocomplete="new-password" bind:value={repeat} />
						{#if lockError?.field === 'repeat'}<span class="error">{lockError.message}</span>{/if}
					</label>
					{#if lockError && !lockError.field}<p class="error" role="alert">
							{lockError.message}
						</p>{/if}
					{#if lockDone}<p role="status">{lockDone}</p>{/if}
					<div class="row">
						<button class="button" disabled={lockBusy || !library.online}>
							{lockBusy ? 'Encrypting…' : library.lock ? 'Change password' : 'Lock with password'}
						</button>
						{#if library.lock}
							<button
								type="button"
								class="link"
								disabled={lockBusy || !library.online}
								onclick={() => changeLock(null, true)}>Remove the lock</button
							>
							<button type="button" class="link" onclick={() => library.lockDevice()}
								>Lock this device now</button
							>
						{/if}
					</div>
					{#if !library.online}<p class="hint">Changing the lock needs a connection.</p>{/if}
				</form>
			{/if}
		</section>
	{:else}
		<h1>{creating ? 'Create an account' : 'Sign in'}</h1>
		<p class="lede">
			{#if library.mine.length > 0}
				Your {library.mine.length === 1 ? 'thought stays' : `${library.mine.length} thoughts stay`} on
				this device until you sign in. Then they move into your account and follow you to your other devices.
			{:else}
				An account keeps your own thoughts on all your devices. Reading needs no account.
			{/if}
		</p>
		<form onsubmit={enter}>
			{#if creating}
				<label class="field">
					<span>Name</span>
					<input autocomplete="name" required bind:value={name} />
					{#if error?.field === 'name'}<span class="error">{error.message}</span>{/if}
				</label>
			{/if}
			<label class="field">
				<span>Email</span>
				<input type="email" autocomplete="email" required bind:value={email} />
				{#if error?.field === 'email'}<span class="error">{error.message}</span>{/if}
			</label>
			<label class="field">
				<span>Password</span>
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
					{creating ? 'Create account' : 'Sign in'}
				</button>
				{#if library.settings.allow_sign_up || creating}
					<button
						type="button"
						class="link"
						onclick={() => {
							creating = !creating;
							error = null;
						}}>{creating ? 'I have an account' : 'Create an account'}</button
					>
				{/if}
			</div>
			{#if !library.online}<p class="hint">Signing in needs a connection.</p>{/if}
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
