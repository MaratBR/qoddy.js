<script lang="ts">
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const error = (field: string) => (form?.field === field ? form.error : null);
</script>

<h1>Collections</h1>
<p class="muted">
	Collections without an owner, which everyone can read. <a href="/admin/settings">Settings</a> chooses
	which one, if any, feeds the home page’s thought of the day.
</p>

<table>
	<thead>
		<tr><th>Name</th><th>Address</th><th class="number">Thoughts</th></tr>
	</thead>
	<tbody>
		{#each data.collections as collection (collection.id)}
			<tr>
				<td><a href="/admin/c/{collection.slug}">{collection.name}</a></td>
				<td class="muted"
					>/c/{collection.slug}{collection.id === data.home ? ' · home page' : ''}</td
				>
				<td class="number">{collection.count}</td>
			</tr>
		{/each}
	</tbody>
</table>

<section>
	<h2>New collection</h2>
	<form method="post" action="?/create">
		<div class="pair">
			<label class="field">
				<span>Name</span>
				<input name="name" required maxlength="80" value={form?.values?.name ?? ''} />
				{#if error('name')}<span class="error">{error('name')}</span>{/if}
			</label>
			<label class="field">
				<span>Address</span>
				<input
					name="slug"
					required
					maxlength="40"
					pattern="[a-z0-9][a-z0-9\-]*"
					placeholder="stoics"
					value={form?.values?.slug ?? ''}
				/>
				{#if error('slug')}<span class="error">{error('slug')}</span>{/if}
			</label>
		</div>
		<label class="field">
			<span>Description</span>
			<textarea name="description" rows="2" maxlength="500"
				>{form?.values?.description ?? ''}</textarea
			>
		</label>
		{#if form?.error && !form.field}<p class="error">{form.error}</p>{/if}
		<button class="button">Create collection</button>
	</form>
</section>

<style>
	table {
		width: 100%;
		border-collapse: collapse;
		margin: 1.5rem 0 3rem;
	}
	th {
		text-align: left;
		font-weight: 500;
		font-size: 0.85rem;
		color: var(--muted);
		padding: 0.4rem 0.75rem 0.4rem 0;
		border-bottom: 1px solid var(--rule);
	}
	td {
		padding: 0.7rem 0.75rem 0.7rem 0;
		border-bottom: 1px solid var(--rule);
	}
	.number {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
	.pair {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0 1.25rem;
	}
	@media (max-width: 40rem) {
		.pair {
			grid-template-columns: 1fr;
		}
	}
</style>
