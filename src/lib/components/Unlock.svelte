<script lang="ts">
	import { library, LibraryError } from '#lib/client/library.svelte.ts';

	let password = $state('');
	let error = $state<string | null>(null);
	let busy = $state(false);

	async function unlock(event: SubmitEvent) {
		event.preventDefault();
		busy = true;
		error = null;
		try {
			await library.unlock(password);
			password = '';
		} catch (failure) {
			error = failure instanceof LibraryError ? failure.message : 'Could not unlock.';
		} finally {
			busy = false;
		}
	}
</script>

<form class="unlock" onsubmit={unlock}>
	{#if library.me}
		<input
			class="visually-hidden"
			autocomplete="username"
			value={library.me.email}
			readonly
			tabindex="-1"
			aria-hidden="true"
		/>
	{/if}
	<p>Your thoughts are locked with a password. Enter it to read them on this device.</p>
	<label class="field">
		<span>Password</span>
		<input type="password" autocomplete="current-password" required bind:value={password} />
		{#if error}<span class="error" role="alert">{error}</span>{/if}
	</label>
	<button class="button" disabled={busy}>{busy ? 'Unlocking…' : 'Unlock'}</button>
</form>

<style>
	.unlock {
		max-width: 26rem;
	}
</style>
