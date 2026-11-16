<script lang="ts">
	// Keeps a copy of a public thought in your own collection.
	import { library, LibraryError } from '#lib/client/library.svelte.ts';
	import { t } from '#lib/client/i18n.svelte.ts';
	import type { PublicThought } from '#lib/wire.ts';
	import Icon from './Icon.svelte';

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
	<a class="icon kept" href="/t/{kept.id}" aria-label={t.thought.kept} title={t.thought.kept}
		><Icon name="bookmark" filled /></a
	>
{:else}
	<button class="icon" onclick={keep} aria-label={t.thought.keep} title={t.thought.keep}
		><Icon name="bookmark" /></button
	>
{/if}
{#if error}<span class="error" role="alert">{error}</span>{/if}

<style>
	/* Kept: on, as a pressed toggle is. */
	.kept,
	.kept:hover {
		color: var(--accent);
		background: color-mix(in oklab, var(--accent) 15%, transparent);
	}
	.error {
		align-self: center;
		margin: 0;
	}
</style>
