<script lang="ts">
	// The app's language. Signed in, the choice is saved to the account.
	import { library } from '#lib/client/library.svelte.ts';
	import { i18n, t } from '#lib/client/i18n.svelte.ts';
	import { LOCALES } from '#lib/locales.ts';
</script>

<div class="languages" role="radiogroup" aria-label={t.menu.language}>
	{#each LOCALES as option (option.id)}
		<button
			role="radio"
			class="link"
			lang={option.id}
			aria-checked={i18n.locale === option.id}
			onclick={() => library.setLocale(option.id)}>{option.name}</button
		>
	{/each}
</div>

<style>
	.languages {
		display: flex;
		flex-wrap: wrap;
		gap: 0 1.25rem;
	}
	.link {
		text-decoration: none;
		color: var(--muted);
	}
	.link[aria-checked='true'] {
		color: var(--ink);
		text-decoration: underline;
	}
</style>
