<script lang="ts">
	// Account → Collections: your own collections (Your thoughts always, others
	// to make, rename and delete), which one the home page shows, and which of
	// the site's collections this device shows. The collections follow the
	// account; the home page and what is hidden stay on this device.
	import {
		library,
		LibraryError,
		MINE,
		COLLECTION_NAME_LIMIT
	} from '#lib/client/library.svelte.ts';
	import { t } from '#lib/client/i18n.svelte.ts';
	import SettingsPage from '#lib/components/SettingsPage.svelte';
	import Select from '#lib/components/Select.svelte';
	import Icon from '#lib/components/Icon.svelte';

	let name = $state('');
	let renaming = $state<string | null>(null);
	let newName = $state('');
	let error = $state<string | null>(null);
	let busy = $state(false);

	async function run(action: () => Promise<unknown>) {
		busy = true;
		error = null;
		try {
			await action();
		} catch (thrown) {
			error = thrown instanceof LibraryError ? thrown.message : t.errors.generic;
		} finally {
			busy = false;
		}
	}

	function create(event: SubmitEvent) {
		event.preventDefault();
		void run(async () => {
			await library.createCollection(name);
			name = '';
		});
	}

	function rename(event: SubmitEvent, id: string) {
		event.preventDefault();
		void run(async () => {
			await library.renameCollection(id, newName);
			renaming = null;
		});
	}

	function remove(id: string, title: string) {
		if (!confirm(t.collections.deleteConfirm(title))) return;
		void run(() => library.deleteCollection(id));
	}

	/** The site's home collection, while this device shows it. */
	const siteHome = $derived(library.shownCollections.find((c) => c.id === library.settings.home));
	const homeOptions = $derived([
		...(siteHome ? [{ value: '', label: t.collections.siteChoice(siteHome.name) }] : []),
		{ value: MINE, label: t.common.yourThoughts },
		...library.myCollections.map((c) => ({ value: c.slug, label: c.name })),
		...library.shownCollections
			.filter((c) => c.id !== siteHome?.id)
			.map((c) => ({ value: c.slug, label: c.name }))
	]);
	/** The choice as the list shows it: a gone choice reads as what home shows instead. */
	const home = $derived(
		homeOptions.some((option) => option.value === library.homeChoice)
			? library.homeChoice!
			: siteHome
				? ''
				: MINE
	);
</script>

<SettingsPage title={t.collections.title}>
	<section>
		<h2 class="label">{t.collections.yours}</h2>
		<ul class="rows">
			<li>
				<a class="name" href="/c/mine/all">{t.common.yourThoughts}</a>
				<span class="hint">{t.collections.defaultOne(library.countMine(null))}</span>
			</li>
			{#each library.myCollections as collection (collection.id)}
				<li>
					{#if renaming === collection.id}
						<form class="rename" onsubmit={(event) => rename(event, collection.id)}>
							<input
								bind:value={newName}
								maxlength={COLLECTION_NAME_LIMIT}
								aria-label={t.collections.name}
								required
							/>
							<button class="link" disabled={busy}>{t.collections.save}</button>
							<button type="button" class="link" onclick={() => (renaming = null)}
								>{t.write.cancel}</button
							>
						</form>
					{:else}
						<a class="name" href="/c/{collection.slug}/all">{collection.name}</a>
						<span class="hint">{t.collections.count(library.countMine(collection.id))}</span>
						<span class="tools">
							<button
								class="icon"
								aria-label={t.collections.rename}
								title={t.collections.rename}
								onclick={() => {
									renaming = collection.id;
									newName = collection.name;
								}}><Icon name="edit" /></button
							>
							<button
								class="link delete"
								disabled={busy}
								onclick={() => remove(collection.id, collection.name)}
								>{t.collections.delete}</button
							>
						</span>
					{/if}
				</li>
			{/each}
		</ul>
		<form class="row create" onsubmit={create}>
			<input
				bind:value={name}
				maxlength={COLLECTION_NAME_LIMIT}
				placeholder={t.collections.newName}
				aria-label={t.collections.name}
			/>
			<button class="button secondary" disabled={busy || !name.trim()}
				>{t.collections.create}</button
			>
		</form>
		<p class="hint">{t.collections.yoursHint}</p>
		{#if error}<p class="error" role="alert">{error}</p>{/if}
	</section>

	<section>
		<h2 class="label" id="home-label">{t.menu.home}</h2>
		<Select
			bind:value={() => home, (value) => library.setHome(value || null)}
			options={homeOptions}
			labelledby="home-label"
		/>
	</section>

	{#if library.collections.length > 0}
		<section>
			<h2 class="label">{t.collections.shared(library.settings.site_name)}</h2>
			<div class="switches">
				<label class="switch-row">
					{t.collections.showShared}
					<input
						type="checkbox"
						role="switch"
						checked={!library.hideShared}
						onchange={(event) => library.setHideShared(!event.currentTarget.checked)}
					/>
				</label>
				{#if !library.hideShared}
					{#each library.collections as collection (collection.id)}
						<label class="switch-row">
							{collection.name}
							<input
								type="checkbox"
								role="switch"
								checked={!library.hides(collection.id)}
								onchange={(event) => library.setHidden(collection.id, !event.currentTarget.checked)}
							/>
						</label>
					{/each}
				{/if}
			</div>
			<p class="hint">{t.collections.sharedHint}</p>
		</section>
	{/if}
</SettingsPage>

<style>
	.rows {
		list-style: none;
		margin: 0 0 1rem;
		padding: 0;
		border-radius: calc(var(--radius) + 4px);
		background: color-mix(in oklab, var(--ink) 5%, transparent);
	}
	.rows li {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.25rem 0.75rem;
		min-height: 3.25rem;
		padding: 0.4rem 0.6rem 0.4rem 0.9rem;
	}
	.rows li + li {
		border-top: 1px solid color-mix(in oklab, var(--ink) 10%, transparent);
	}
	.name {
		color: inherit;
		text-decoration: none;
		font-size: 1.05rem;
		overflow-wrap: anywhere;
	}
	.tools {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-inline-start: auto;
	}
	.tools .link {
		margin: 0;
	}
	.delete {
		color: light-dark(#a3241c, #f2a093);
	}
	.rename {
		display: flex;
		align-items: center;
		gap: 0.5rem 1rem;
		flex-wrap: wrap;
		width: 100%;
	}
	.rename input {
		flex: 1 1 12rem;
	}
	.rename .link {
		margin: 0;
	}
	.create input {
		flex: 1 1 14rem;
		width: auto;
	}
	.create {
		margin-bottom: 0.6rem;
	}
	.switches {
		display: grid;
		gap: 0.5rem;
	}
	.hint {
		margin-top: 0.6rem;
	}
	.rows .hint {
		margin: 0;
	}
</style>
