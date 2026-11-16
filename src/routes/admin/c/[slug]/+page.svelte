<script lang="ts">
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const error = (field: string) => (form?.field === field ? form.error : null);
	const values = $derived((form?.values ?? {}) as Record<string, string | undefined>);

	const pageHref = (page: number) => {
		const params = new URLSearchParams();
		if (data.search) params.set('q', data.search);
		if (page > 1) params.set('page', String(page));
		const query = params.toString();
		return query ? `?${query}` : '?';
	};
</script>

<p class="crumbs"><a href="/admin">Collections</a></p>
<h1>{data.collection.name}</h1>
{#if data.collection.hidden}
	<p class="muted">Hidden from readers.</p>
{:else if data.listing.total === 0 && !data.search}
	<p class="muted">Empty, so hidden from readers until it has a thought.</p>
{/if}

{#if data.imported}
	<p role="status" class="notice">Added {data.imported} thoughts.</p>
{/if}

<div class="toolbar">
	<a class="button" href="/admin/t/new?c={data.collection.slug}">Add a thought</a>
	<form method="get" class="search" role="search">
		<label class="visually-hidden" for="q">Search thoughts</label>
		<input id="q" name="q" type="search" value={data.search} placeholder="Text, author or source" />
		<button class="button secondary">Search</button>
	</form>
</div>

<p class="muted count">
	{data.listing.total}
	{data.listing.total === 1 ? 'thought' : 'thoughts'}{data.search ? ` match “${data.search}”` : ''}
	{#if data.search}<a href="?">Show all</a>{/if}
</p>

<ol class="thoughts">
	{#each data.listing.thoughts as thought (thought.id)}
		<li>
			<a href="/admin/t/{thought.id}" lang={thought.lang} dir="auto">{thought.text}</a>
			<span class="muted">
				{thought.author ?? 'No author'}{thought.source ? `, ${thought.source}` : ''}{thought.notes
					? ' · has notes'
					: ''}
			</span>
		</li>
	{/each}
</ol>

{#if data.listing.pages > 1}
	<nav class="pages" aria-label="Pages">
		{#if data.listing.page > 1}<a href={pageHref(data.listing.page - 1)}>Newer</a>{/if}
		<span class="muted">Page {data.listing.page} of {data.listing.pages}</span>
		{#if data.listing.page < data.listing.pages}<a href={pageHref(data.listing.page + 1)}>Older</a
			>{/if}
	</nav>
{/if}

<section>
	<h2>Import from CSV</h2>
	<p class="hint">
		A header row, then one thought per row. Columns: {data.columns.join(', ')}. Only text is
		required. All rows are added, or none if any row has a problem.
	</p>
	<form method="post" action="?/import" enctype="multipart/form-data">
		<label class="field">
			<span>CSV file</span>
			<input type="file" name="file" accept=".csv,text/csv" required />
			{#if error('file')}<span class="error">{error('file')}</span>{/if}
		</label>
		<button class="button secondary">Import</button>
	</form>
</section>

<section>
	<h2>Details</h2>
	<form method="post" action="?/update">
		<label class="field">
			<span>Name</span>
			<input name="name" required maxlength="80" value={values.name ?? data.collection.name} />
			{#if error('name')}<span class="error">{error('name')}</span>{/if}
		</label>
		<label class="field">
			<span>Address</span>
			<input name="slug" required maxlength="40" value={values.slug ?? data.collection.slug} />
			{#if error('slug')}<span class="error">{error('slug')}</span>{/if}
		</label>
		<label class="field">
			<span>Description</span>
			<textarea name="description" rows="2" maxlength="500"
				>{values.description ?? data.collection.description}</textarea
			>
		</label>
		{#if form?.error && !form.field}<p class="error">{form.error}</p>{/if}
		<button class="button">Save details</button>
	</form>
</section>

<section>
	<h2>Readers</h2>
	{#if data.collection.hidden}
		<p>
			Hidden: readers’ devices drop this collection and its thoughts on their next sync. Showing it
			sends them back.
		</p>
		<form method="post" action="?/visibility">
			<input type="hidden" name="hidden" value="false" />
			<button class="button">Show to readers</button>
		</form>
	{:else if data.isHome}
		<p>
			Shown. The home page shows this collection’s thought of the day, so it cannot be hidden;
			choose another home page in <a href="/admin/settings">Settings</a> first.
		</p>
	{:else}
		<p>
			Shown. Hiding keeps the collection and its thoughts here but drops them from readers’ devices
			on their next sync. Readers keep any they kept in their own thoughts.
		</p>
		<form method="post" action="?/visibility">
			<input type="hidden" name="hidden" value="true" />
			<button class="button secondary">Hide from readers</button>
		</form>
	{/if}
	{#if error('hidden')}<p class="error">{error('hidden')}</p>{/if}
</section>

{#if data.isHome}
	<section>
		<h2>Delete</h2>
		<p>
			The home page shows this collection’s thought of the day. To delete it, first choose another
			home page in <a href="/admin/settings">Settings</a>.
		</p>
	</section>
{:else}
	<section>
		<h2>Delete</h2>
		<p>
			Deleting removes the collection and its {data.listing.total} thoughts from every device on its next
			sync. Readers keep any they kept in their own thoughts.
		</p>
		<form method="post" action="?/delete">
			<label class="field">
				<span>Type “{data.collection.slug}” to confirm</span>
				<input name="confirm" autocomplete="off" />
				{#if error('confirm')}<span class="error">{error('confirm')}</span>{/if}
			</label>
			<button class="button danger">Delete collection</button>
		</form>
	</section>
{/if}

<style>
	.crumbs {
		margin: 0 0 0.25rem;
		font-size: 0.9rem;
	}
	.notice {
		color: var(--accent);
	}
	.toolbar {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		align-items: center;
		justify-content: space-between;
		margin: 1.5rem 0 0.5rem;
	}
	.search {
		display: flex;
		gap: 0.5rem;
		flex: 1;
		max-width: 26rem;
	}
	.count {
		font-size: 0.9rem;
		display: flex;
		gap: 1rem;
	}
	.thoughts {
		list-style: none;
		padding: 0;
		margin: 0 0 1.5rem;
	}
	.thoughts li {
		display: grid;
		gap: 0.15rem;
		padding: 0.75rem 0;
		border-top: 1px solid var(--rule);
	}
	.thoughts a {
		text-decoration: none;
		font-size: 1.1rem;
		line-height: 1.35;
	}
	.thoughts a:hover {
		color: var(--accent);
	}
	.thoughts .muted {
		font-size: 0.9rem;
	}
	.pages {
		display: flex;
		gap: 1.5rem;
		align-items: baseline;
	}
	section {
		margin-top: 3rem;
		padding-top: 1.5rem;
		border-top: 1px solid var(--rule);
		max-width: 36rem;
	}
</style>
