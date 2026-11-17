<script lang="ts">
	// Account → Your data: where each of your thoughts is kept (in the account,
	// or on this device only) and moving or deleting them there; export as a zip
	// made on this device; and (signed in) delete the account.
	import { SvelteSet } from 'svelte/reactivity';
	import { library, LibraryError, type MyThought } from '#lib/client/library.svelte.ts';
	import { t } from '#lib/client/i18n.svelte.ts';
	import SettingsPage from '#lib/components/SettingsPage.svelte';

	const selected = new SvelteSet<string>();
	let working = $state(false);
	let ask: HTMLDialogElement | undefined = $state();
	/** Answers the delete dialog: 'everywhere', 'here', or '' (cancel). */
	let answer: ((choice: string) => void) | null = null;

	const inAccount = $derived(library.mine.filter((thought) => thought.place !== 'device'));
	const onDevice = $derived(library.mine.filter((thought) => thought.place === 'device'));
	const chosen = (list: MyThought[]) =>
		list.filter((thought) => selected.has(thought.id)).map((thought) => thought.id);

	async function act(action: () => Promise<unknown>) {
		working = true;
		dataError = null;
		try {
			await action();
			selected.clear();
		} catch (thrown) {
			dataError = message(thrown, t.errors.generic);
		} finally {
			working = false;
		}
	}

	function keepHere() {
		const ids = chosen(inAccount);
		if (!ids.length || !confirm(t.data.keepHereConfirm(ids.length))) return;
		void act(() => library.keepOnlyHere(ids));
	}

	function moveUp() {
		const ids = chosen(onDevice);
		if (ids.length) void act(() => library.moveToAccount(ids));
	}

	/** Thoughts the account has: delete them everywhere, or from this device only. */
	async function deleteFromAccount() {
		const ids = chosen(inAccount);
		if (!ids.length || !ask) return;
		const choice = await new Promise<string>((resolve) => {
			answer = resolve;
			ask!.returnValue = '';
			ask!.showModal();
		});
		if (choice === 'everywhere') {
			void act(async () => {
				for (const id of ids) await library.deleteMine(id);
			});
		} else if (choice === 'here') {
			void act(() => library.removeHere(ids));
		}
	}

	function deleteHere() {
		const ids = chosen(onDevice);
		if (!ids.length || !confirm(t.data.deleteHereConfirm(ids.length))) return;
		void act(async () => {
			for (const id of ids) await library.deleteMine(id);
		});
	}

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

{#snippet list(items: MyThought[], label: string)}
	{@const all = items.length > 0 && items.every((thought) => selected.has(thought.id))}
	<div class="thoughts">
		<label class="pick all">
			<input
				type="checkbox"
				checked={all}
				indeterminate={!all && items.some((thought) => selected.has(thought.id))}
				onchange={(event) => {
					for (const thought of items) {
						if (event.currentTarget.checked) selected.add(thought.id);
						else selected.delete(thought.id);
					}
				}}
			/>
			<span class="label">{label}</span>
			<span class="label count">{items.length}</span>
		</label>
		<ul>
			{#each items as thought (thought.id)}
				<li>
					<label class="pick">
						<input
							type="checkbox"
							checked={selected.has(thought.id)}
							onchange={(event) =>
								event.currentTarget.checked
									? selected.add(thought.id)
									: selected.delete(thought.id)}
						/>
						<span class="text" lang={thought.lang} dir="auto">{thought.text}</span>
						{#if thought.place === 'pending'}<span class="tag">{t.data.pending}</span>{/if}
					</label>
				</li>
			{/each}
		</ul>
	</div>
{/snippet}

<SettingsPage title={t.account.data}>
	{#if deletedNotice}<p role="status" class="notice">{t.account.deleted}</p>{/if}

	{#if library.mine.length > 0 || library.hiddenHere > 0}
		<section>
			<h2 class="label">{t.data.where}</h2>
			<p>{library.me ? t.data.whereHint : t.data.whereHintSignedOut}</p>
			{#if inAccount.length > 0}
				{@render list(inAccount, t.data.inAccount)}
				<div class="row actions">
					<button
						class="button secondary"
						disabled={working || !library.me || chosen(inAccount).length === 0}
						onclick={keepHere}>{t.data.keepHere}</button
					>
					<button
						class="button secondary"
						disabled={working || chosen(inAccount).length === 0}
						onclick={deleteFromAccount}>{t.data.delete}</button
					>
				</div>
			{/if}
			{#if onDevice.length > 0}
				{@render list(onDevice, t.data.onDevice)}
				<div class="row actions">
					{#if library.me}
						<button
							class="button secondary"
							disabled={working || chosen(onDevice).length === 0}
							onclick={moveUp}>{t.data.moveToAccount}</button
						>
					{/if}
					<button
						class="button secondary"
						disabled={working || chosen(onDevice).length === 0}
						onclick={deleteHere}>{t.data.delete}</button
					>
				</div>
			{/if}
			{#if library.hiddenHere > 0}
				<p class="hidden">
					{t.data.hiddenHere(library.hiddenHere)}
					<button
						class="link"
						disabled={working || !library.online}
						onclick={() => act(() => library.restoreHidden())}>{t.data.restore}</button
					>
				</p>
			{/if}
			{#if library.sealed > 0}<p class="hint">{t.data.sealed(library.sealed)}</p>{/if}
		</section>
	{/if}

	<dialog
		bind:this={ask}
		class="ask"
		aria-labelledby="ask-title"
		onclose={() => {
			answer?.(ask?.returnValue ?? '');
			answer = null;
		}}
	>
		<form method="dialog">
			<h2 id="ask-title">{t.data.deleteTitle(chosen(inAccount).length)}</h2>
			<p>{t.data.deleteQuestion}</p>
			<div class="choices">
				<button class="button danger" value="everywhere">{t.data.deleteEverywhere}</button>
				<button class="button secondary" value="here">{t.data.deleteHereOnly}</button>
				<button class="link" value="">{t.write.cancel}</button>
			</div>
		</form>
	</dialog>

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
	.thoughts {
		margin-top: 1.25rem;
		border-radius: calc(var(--radius) + 4px);
		background: color-mix(in oklab, var(--ink) 5%, transparent);
	}
	.thoughts ul {
		list-style: none;
		margin: 0;
		padding: 0;
		max-height: 22rem;
		overflow-y: auto;
		overscroll-behavior: contain;
	}
	.thoughts li {
		border-top: 1px solid color-mix(in oklab, var(--ink) 10%, transparent);
	}
	.pick {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		min-height: 2.9rem;
		padding: 0.4rem 0.9rem;
		cursor: pointer;
	}
	.pick input {
		flex: none;
	}
	.pick .count {
		margin-inline-start: auto;
		font-variant-numeric: tabular-nums;
	}
	.text {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.tag {
		flex: none;
		font-family: var(--ui-font);
		font-size: 0.72rem;
		font-weight: 600;
		color: var(--muted);
		background: color-mix(in oklab, var(--ink) 7%, transparent);
		border-radius: 999px;
		padding: 0.15em 0.65em;
	}
	.actions {
		margin-top: 0.75rem;
	}
	.hidden {
		margin-top: 1.25rem;
	}
	.hidden .link {
		margin-inline-start: 0;
	}
	.ask {
		max-width: min(28rem, calc(100% - 2.5rem));
		padding: 1.5rem;
		border: 0;
		border-radius: calc(var(--radius) + 8px);
		color: var(--ink);
		background: var(--paper);
		box-shadow: 0 20px 50px -12px color-mix(in oklab, #000 40%, transparent);
	}
	.ask::backdrop {
		background: color-mix(in oklab, #000 35%, transparent);
	}
	.ask h2 {
		margin: 0 0 0.5rem;
		font-size: 1.2rem;
	}
	.choices {
		display: grid;
		gap: 0.5rem;
		margin-top: 1.25rem;
	}
	.choices .link {
		justify-self: center;
		margin: 0;
	}
</style>
