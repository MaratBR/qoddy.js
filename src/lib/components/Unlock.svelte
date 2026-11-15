<script lang="ts">
	import { library, LibraryError } from '#lib/client/library.svelte.ts';
	import { t } from '#lib/client/i18n.svelte.ts';

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
			error = failure instanceof LibraryError ? failure.message : t.unlock.failed;
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
	<p>{t.unlock.prompt}</p>
	<label class="field">
		<span>{t.common.password}</span>
		<input type="password" autocomplete="current-password" required bind:value={password} />
		{#if error}<span class="error" role="alert">{error}</span>{/if}
	</label>
	<button class="button" disabled={busy}>{busy ? t.unlock.unlocking : t.unlock.unlock}</button>
</form>

<style>
	.unlock {
		max-width: 26rem;
	}
</style>
