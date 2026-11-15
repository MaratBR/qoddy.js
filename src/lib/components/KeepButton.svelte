<script lang="ts">
	// Keeps a copy of a public thought in your own collection.
	import { library, LibraryError } from '#lib/client/library.svelte.ts';
	import { t } from '#lib/client/i18n.svelte.ts';
	import type { PublicThought } from '#lib/wire.ts';

	let { thought }: { thought: PublicThought } = $props();
	let error = $state<string | null>(null);
	const kept = $derived(library.keptFrom(thought.id));

	async function keep() {
		error = null;
		try {
			await library.keep(thought);
		} catch (failure) {
			error = failure instanceof LibraryError ? failure.message : t.thought.couldNotKeep;
		}
	}
</script>

{#if kept}
	<a class="link kept" href="/t/{kept.id}">{t.thought.kept}</a>
{:else}
	<button class="link" onclick={keep}>{t.thought.keep}</button>
{/if}
{#if error}<span class="error" role="alert">{error}</span>{/if}

<style>
	.kept {
		color: var(--accent);
	}
</style>
