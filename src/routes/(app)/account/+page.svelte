<script lang="ts">
	// Account: who you are (or the form to sign in or create an account), then
	// the settings as a list of pages: appearance, privacy, your data.
	import { library, LibraryError, UnsyncedError } from '#lib/client/library.svelte.ts';
	import { i18n, t } from '#lib/client/i18n.svelte.ts';
	import { findTheme, THEMES } from '#lib/themes.ts';
	import Icon from '#lib/components/Icon.svelte';

	type Failure = { message: string; field?: string } | null;

	let creating = $state(false);
	let name = $state('');
	let email = $state('');
	let password = $state('');
	let error = $state<Failure>(null);
	let busy = $state(false);

	const failure = (thrown: unknown, fallback: string): Failure =>
		thrown instanceof LibraryError
			? { message: thrown.message, field: thrown.field }
			: { message: fallback };

	async function enter(event: SubmitEvent) {
		event.preventDefault();
		busy = true;
		error = null;
		try {
			try {
				if (creating) await library.signUp(name, email, password);
				else await library.signIn(email, password);
			} catch (thrown) {
				// This device holds another account's unsynced changes: only on the reader's word.
				if (!(thrown instanceof UnsyncedError) || !confirm(thrown.message)) throw thrown;
				if (creating) await library.signUp(name, email, password, true);
				else await library.signIn(email, password, true);
			}
			password = '';
		} catch (thrown) {
			if (!(thrown instanceof UnsyncedError)) error = failure(thrown, t.errors.generic);
		} finally {
			busy = false;
		}
	}

	async function signOut() {
		// Count what other tabs wrote too.
		await library.refresh();
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

	const synced = $derived(
		library.lastSync
			? new Date(library.lastSync).toLocaleString(i18n.locale, {
					dateStyle: 'medium',
					timeStyle: 'short'
				})
			: null
	);
	const theme = $derived(findTheme(library.theme) ?? THEMES[0]);
	const locked = $derived(Boolean(library.appLock || library.lock));
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

	<nav aria-label={t.account.settings}>
		{#if !library.me}<h2 class="label">{t.account.settings}</h2>{/if}
		<ul class="group">
			<li>
				<a href="/account/appearance">
					<span class="title">{t.account.appearance}</span>
					<span class="count">{t.themes[theme.id] ?? theme.name}</span>
					<Icon name="chevron" />
				</a>
			</li>
			<li>
				<a href="/account/privacy">
					<span class="title">{t.account.privacy}</span>
					<span class="count state">{locked ? t.stats.on : t.stats.off}</span>
					<Icon name="chevron" />
				</a>
			</li>
			<li>
				<a href="/account/data">
					<span class="title">{t.account.data}</span>
					<span class="count">{library.mine.length}</span>
					<Icon name="chevron" />
				</a>
			</li>
		</ul>
	</nav>

	{#if library.me}
		<div class="out">
			<button class="button secondary" onclick={signOut}>{t.account.signOut}</button>
			<p class="hint">{t.account.signOutHint}</p>
			{#if error}<p class="error" role="alert">{error.message}</p>{/if}
		</div>
	{/if}

	<p class="nerds"><a href="/account/stats">{t.account.stats}</a></p>
</main>

<style>
	main {
		padding: clamp(1.5rem, 5vh, 3rem) clamp(1.25rem, 8vw, 7rem) 4rem;
		max-width: 38rem;
	}
	h1 + .muted {
		margin-top: 0;
	}
	.lede {
		margin-bottom: 2rem;
	}
	nav {
		margin-top: 2rem;
	}
	nav h2 {
		margin: 0 0 0.6rem;
		padding-inline-start: 0.9rem;
	}
	.state::first-letter {
		text-transform: uppercase;
	}
	.out {
		display: grid;
		justify-items: start;
		gap: 0.6rem;
		margin-top: 2.5rem;
	}
	.nerds {
		margin-top: 3.5rem;
		font-size: 0.85rem;
	}
	.nerds a {
		color: var(--muted);
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
