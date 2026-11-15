<script lang="ts">
	import { LIMITS } from '#lib/thought.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const error = (field: string) => (form?.field === field ? form.error : null);
	// After a failed save or a preview, show what was submitted; otherwise the stored thought.
	const values = $derived(
		(form?.values ?? {
			collection: data.collection?.slug,
			text: data.thought?.text,
			author: data.thought?.author,
			source: data.thought?.source,
			notes: data.thought?.notes,
			lang: data.thought?.lang,
			theme: data.thought?.theme,
			color: data.thought?.color,
			tinted: data.thought?.color ? 'on' : undefined,
			font: data.thought?.font
		}) as Record<string, string | null | undefined>
	);
	const preview = $derived(form && 'preview' in form ? form.preview : null);
</script>

<p class="crumbs">
	<a href="/admin">Collections</a>
	{#if data.collection}/ <a href="/admin/c/{data.collection.slug}">{data.collection.name}</a>{/if}
</p>
<h1>{data.thought ? 'Edit thought' : 'Add a thought'}</h1>

{#if preview}
	<figure class="preview" aria-label="Preview">
		<blockquote dir="auto" lang={values.lang || undefined}>{preview.text}</blockquote>
		{#if preview.author || preview.source}
			<figcaption>
				{preview.author ?? ''}{preview.author && preview.source ? ', ' : ''}{#if preview.source}<cite
						>{preview.source}</cite
					>{/if}
			</figcaption>
		{/if}
		{#if preview.notes}
			<div class="prose notes">{@html preview.notes}</div>
		{/if}
	</figure>
{/if}

<form method="post" action="?/save">
	<label class="field">
		<span>Thought</span>
		<textarea
			name="text"
			rows="4"
			required
			maxlength={LIMITS.text}
			dir="auto"
			class="thought-text">{values.text ?? ''}</textarea
		>
		{#if error('text')}<span class="error">{error('text')}</span>{/if}
	</label>

	<div class="pair">
		<label class="field">
			<span>Author</span>
			<input name="author" maxlength={LIMITS.author} value={values.author ?? ''} />
			{#if error('author')}<span class="error">{error('author')}</span>{/if}
		</label>
		<label class="field">
			<span>Source</span>
			<input
				name="source"
				maxlength={LIMITS.source}
				placeholder="Book, speech or year"
				value={values.source ?? ''}
			/>
			{#if error('source')}<span class="error">{error('source')}</span>{/if}
		</label>
	</div>

	<label class="field">
		<span>Notes</span>
		<textarea name="notes" rows="8" maxlength={LIMITS.notes}>{values.notes ?? ''}</textarea>
		<span class="hint">
			Optional. What the thought means, where it comes from. Simple markup: paragraphs, **bold**,
			*italic*, [links](https://…), lists, &gt; quotes and # headings.
		</span>
		{#if error('notes')}<span class="error">{error('notes')}</span>{/if}
	</label>

	<fieldset>
		<legend>Style and language</legend>
		<div class="pair">
			<label class="field">
				<span>Theme</span>
				<select name="theme">
					<option value="">Reader’s choice</option>
					{#each data.themes as theme (theme.id)}
						<option value={theme.id} selected={values.theme === theme.id}>{theme.name}</option>
					{/each}
				</select>
				{#if error('theme')}<span class="error">{error('theme')}</span>{/if}
			</label>
			<label class="field">
				<span>Font</span>
				<input name="font" placeholder="Any Google Fonts family" value={values.font ?? ''} />
				{#if error('font')}<span class="error">{error('font')}</span>{/if}
			</label>
		</div>
		<div class="pair">
			<div class="field">
				<label class="check">
					<input type="checkbox" name="tinted" checked={!!values.tinted} />
					Tint the page
				</label>
				<input type="color" name="color" aria-label="Tint color" value={values.color || '#7a5c3e'} />
				{#if error('color')}<span class="error">{error('color')}</span>{/if}
			</div>
			<label class="field">
				<span>Language</span>
				<input name="lang" placeholder="en" maxlength="35" value={values.lang ?? ''} />
				{#if error('lang')}<span class="error">{error('lang')}</span>{/if}
			</label>
		</div>
	</fieldset>

	<label class="field">
		<span>Collection</span>
		<select name="collection">
			{#each data.collections as collection (collection.id)}
				<option value={collection.slug} selected={values.collection === collection.slug}
					>{collection.name}</option
				>
			{/each}
		</select>
		{#if data.thought}
			<span class="hint">Moving a thought puts it last in its new collection’s rotation.</span>
		{/if}
		{#if error('collection')}<span class="error">{error('collection')}</span>{/if}
	</label>

	{#if form?.error && !form.field}<p class="error">{form.error}</p>{/if}

	<div class="actions">
		<button class="button">{data.thought ? 'Save changes' : 'Add thought'}</button>
		<button class="button secondary" formaction="?/preview" formnovalidate>Preview</button>
		{#if data.collection}<a href="/admin/c/{data.collection.slug}">Cancel</a>{/if}
	</div>
</form>

{#if data.thought}
	<form method="post" action="?/delete" class="delete">
		<button class="button danger">Delete thought</button>
		<span class="hint">Readers who kept it keep their copy.</span>
	</form>
{/if}

<style>
	.crumbs {
		margin: 0 0 0.25rem;
		font-size: 0.9rem;
	}
	form {
		max-width: 44rem;
	}
	.thought-text {
		font-family: var(--font);
		font-size: 1.3rem;
		line-height: 1.4;
	}
	fieldset {
		border: 1px solid var(--rule);
		padding: 0.75rem 1.25rem 0.25rem;
		margin: 1.5rem 0;
	}
	legend {
		padding: 0 0.4rem;
		color: var(--muted);
		font-size: 0.9rem;
	}
	.pair {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0 1.25rem;
	}
	input[type='color'] {
		inline-size: 4rem;
		block-size: 2.25rem;
		padding: 0.15rem;
	}
	.actions {
		display: flex;
		gap: 1rem;
		align-items: center;
		margin-top: 1.5rem;
	}
	.delete {
		display: flex;
		gap: 1rem;
		align-items: center;
		margin-top: 3rem;
		padding-top: 1.5rem;
		border-top: 1px solid var(--rule);
	}
	.preview {
		margin: 1.5rem 0 2rem;
		padding: 1.5rem 1.75rem;
		border: 1px solid var(--rule);
		max-width: 44rem;
	}
	.preview blockquote {
		margin: 0;
		font-family: var(--font);
		font-size: 1.5rem;
		line-height: 1.35;
		white-space: pre-line;
	}
	.preview figcaption {
		margin-top: 0.75rem;
		color: var(--muted);
	}
	.notes {
		margin-top: 1.25rem;
		padding-top: 1rem;
		border-top: 1px solid var(--rule);
	}
	@media (max-width: 40rem) {
		.pair {
			grid-template-columns: 1fr;
		}
	}
</style>
