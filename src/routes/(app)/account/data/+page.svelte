<script lang="ts">
	// Account → Your data: export your thoughts as a zip made on this device,
	// and (signed in) delete the account.
	import { library, LibraryError } from '#lib/client/library.svelte.ts';
	import { t } from '#lib/client/i18n.svelte.ts';
	import SettingsPage from '#lib/components/SettingsPage.svelte';

	let exporting = $state(false);
	let deleting = $state(false);
	let dataError = $state<string | null>(null);
	let deletedNotice = $state(false);

	const message = (thrown: unknown, fallback: string) =>
		thrown instanceof LibraryError ? thrown.message : fallback;

	async function exportThoughts() {
		exporting = true;
		dataError = null;
		try {
			const blob = await library.exportThoughts();
			const url = URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;
			link.download = `${library.settings.site_name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-')}-${new Date().toISOString().slice(0, 10)}.zip`;
			document.body.append(link);
			link.click();
			link.remove();
			setTimeout(() => URL.revokeObjectURL(url), 10_000);
		} catch (thrown) {
			dataError = message(thrown, t.account.couldNotExport);
		} finally {
			exporting = false;
		}
	}

	async function deleteAccount() {
		const me = library.me;
		if (!me) return;
		if (!confirm(t.account.deleteConfirm(me.email)) || !confirm(t.account.deleteConfirmAgain)) {
			return;
		}
		deleting = true;
		dataError = null;
		try {
			await library.deleteAccount();
			deletedNotice = true;
		} catch (thrown) {
			dataError = message(thrown, t.account.couldNotDelete);
		} finally {
			deleting = false;
		}
	}
</script>

<SettingsPage title={t.account.data}>
	{#if deletedNotice}<p role="status" class="notice">{t.account.deleted}</p>{/if}

	<section>
		<h2 class="label">{t.account.export}</h2>
		<p>{t.account.exportHint}</p>
		<div class="row">
			<button
				class="button secondary"
				disabled={exporting || library.mine.length === 0}
				onclick={exportThoughts}>{exporting ? t.account.exporting : t.account.exportButton}</button
			>
			{#if library.mine.length === 0}<span class="hint">{t.account.nothingToExport}</span>{/if}
		</div>
	</section>

	{#if library.me}
		<section>
			<h2 class="label">{t.account.deleteAccount}</h2>
			<p>{t.account.deleteHint}</p>
			<button class="button danger" disabled={deleting || !library.online} onclick={deleteAccount}
				>{deleting ? t.account.deleting : t.account.deleteAccount}</button
			>
		</section>
	{/if}

	{#if dataError}<p class="error" role="alert">{dataError}</p>{/if}
</SettingsPage>

<style>
	.notice {
		color: var(--accent);
	}
</style>
