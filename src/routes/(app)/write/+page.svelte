<script lang="ts">
	// Write a thought of your own, or edit one (`?id=`). Set like the thought
	// itself: style choices restyle the page as you make them.
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { library, LibraryError } from '#lib/client/library.svelte.ts';
	import { useLook } from '#lib/client/look.svelte.ts';
	import { renderMarkdown } from '#lib/markdown.ts';
	import { LIMITS, normalizeColor, sizeClass, validFont } from '#lib/thought.ts';
	import { THEMES } from '#lib/themes.ts';
	import Unlock from '#lib/components/Unlock.svelte';

	const id = page.url.searchParams.get('id');
	const existing = id ? library.mineById(id) : undefined;

	let text = $state(existing?.text ?? '');
	let author = $state(existing?.author ?? '');
	let source = $state(existing?.source ?? '');
	let notes = $state(existing?.notes ?? '');
	let theme = $state(existing?.theme ?? '');
	let colored = $state(Boolean(existing?.color));
	let color = $state(existing?.color ?? '#6b4fa8');
	let font = $state(existing?.font ?? '');
	let lang = $state(existing?.lang ?? '');
	let preview = $state(false);

	let error = $state<{ message: string; field?: string } | null>(null);
	let saving = $state(false);
	const styled = Boolean(existing?.theme || existing?.color || existing?.font || existing?.lang);

	useLook(() => ({
		theme: theme || null,
		color: colored ? normalizeColor(color) : null,
		// Load a font only once it is a plausible family name.
		font: validFont(font.trim()) ? font.trim() : null
	}));

	async function save(event: SubmitEvent) {
		event.preventDefault();
		saving = true;
		error = null;
		try {
			const saved = await library.saveMine(
				{ text, author, source, notes, theme, color: colored ? color : '', font, lang },
				{ id: existing?.id }
			);
			await goto(`/t/${saved}`);
		} catch (failure) {
			error =
				failure instanceof LibraryError
					? { message: failure.message, field: failure.field }
					: { message: 'Could not save it.' };
		} finally {
			saving = false;
		}
	}

	async function remove() {
		if (!existing || !confirm('Delete this thought? This cannot be undone.')) return;
		await library.deleteMine(existing.id);
		await goto('/c/mine/all');
	}

	const fieldError = (field: string) => (error?.field === field ? error.message : null);
</script>

<svelte:head>
	<title>{existing ? 'Edit thought' : 'Write a thought'} · {library.settings.site_name}</title>
</svelte:head>

<main>
	{#if id && !existing}
		{#if library.locked && library.sealed > 0}
			<Unlock />
		{:else}
			<h1>Not on this device</h1>
			<p>This thought is not among yours here. <a href="/c/mine/all">See your thoughts</a></p>
		{/if}
	{:else if library.signedIn && library.locked}
		<Unlock />
	{:else}
		<form onsubmit={save} novalidate>
			<label class="thought">
				<span class="visually-hidden">The thought</span>
				<textarea
					class={sizeClass(text || 'x')}
					bind:value={text}
					lang={lang || undefined}
					dir="auto"
					rows="3"
					maxlength={LIMITS.text}
					placeholder="A thought worth keeping"
					aria-invalid={fieldError('text') ? true : undefined}></textarea>
			</label>
			{#if fieldError('text')}<p class="error" role="alert">{fieldError('text')}</p>{/if}

			<div class="attribution">
				<label class="field">
					<span>Who said or wrote it</span>
					<input
						bind:value={author}
						maxlength={LIMITS.author}
						placeholder="Leave empty if it is yours"
					/>
				</label>
				<label class="field">
					<span>Where it comes from</span>
					<input
						bind:value={source}
						maxlength={LIMITS.source}
						placeholder="A book, a talk, a walk"
					/>
				</label>
			</div>

			<div class="field">
				<div class="notes-head">
					<label for="notes">Notes</label>
					{#if notes.trim()}
						<button type="button" class="link" onclick={() => (preview = !preview)}>
							{preview ? 'Edit notes' : 'Preview notes'}
						</button>
					{/if}
				</div>
				{#if preview && notes.trim()}
					<!-- renderMarkdown escapes all input before adding its own markup. -->
					<div class="prose preview">{@html renderMarkdown(notes)}</div>
				{:else}
					<textarea id="notes" bind:value={notes} rows="5" maxlength={LIMITS.notes}></textarea>
				{/if}
				<p class="hint">
					What it means to you, or where it came from. **Bold**, *italic*, lists, &gt; quotes and
					[links](https://…) work.
				</p>
			</div>

			<details open={styled}>
				<summary>Style and language</summary>
				<div class="style">
					<label class="field">
						<span>Theme</span>
						<select bind:value={theme}>
							<option value="">The reader’s own</option>
							{#each THEMES as option (option.id)}
								<option value={option.id}>{option.name}</option>
							{/each}
						</select>
					</label>
					<div class="field">
						<label class="check"
							><input type="checkbox" bind:checked={colored} /> A color of its own</label
						>
						{#if colored}<input type="color" bind:value={color} aria-label="Color" />{/if}
					</div>
					<label class="field">
						<span>Font</span>
						<input bind:value={font} placeholder="Any Google Fonts family, e.g. Lora" />
						{#if fieldError('font')}<span class="error">{fieldError('font')}</span>{/if}
					</label>
					<label class="field">
						<span>Language</span>
						<input bind:value={lang} placeholder="A tag like en, fr or zh-Hans" />
						{#if fieldError('lang')}<span class="error">{fieldError('lang')}</span>{/if}
					</label>
				</div>
			</details>

			{#if error && !['text', 'font', 'lang'].includes(error.field ?? '')}
				<p class="error" role="alert">{error.message}</p>
			{/if}

			<div class="actions">
				<button class="button" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
				<a class="link" href={existing ? `/t/${existing.id}` : '/c/mine'}>Cancel</a>
				{#if existing}
					<button type="button" class="link delete" onclick={remove}>Delete</button>
				{/if}
			</div>
			{#if !library.signedIn}
				<p class="hint">
					Saved on this device. <a href="/account">Sign in</a> to keep your thoughts on all your devices.
				</p>
			{:else if library.lock}
				<p class="hint">Encrypted on this device before it syncs.</p>
			{/if}
		</form>
	{/if}
</main>

<style>
	main {
		padding: clamp(1.5rem, 5vh, 3rem) clamp(1.25rem, 8vw, 7rem) 4rem;
		max-width: 60rem;
	}
	.thought textarea {
		display: block;
		background: transparent;
		border: 0;
		border-bottom: 1px dashed var(--rule);
		border-radius: 0;
		padding: 0 0 0.5rem;
		font-family: var(--thought-font, var(--font));
		font-weight: var(--thought-weight);
		font-style: var(--thought-style);
		letter-spacing: var(--thought-tracking);
		line-height: var(--thought-leading);
		font-size: clamp(1.75rem, 1.1rem + 2.6vw, 3.25rem);
		field-sizing: content;
		min-height: 3lh;
		resize: none;
	}
	.thought textarea.long {
		font-size: clamp(1.35rem, 1rem + 1.2vw, 2rem);
	}
	.thought textarea:focus-visible {
		box-shadow: none;
		border-bottom: 1px solid var(--accent);
	}
	.thought textarea::placeholder {
		color: color-mix(in oklab, var(--muted) 70%, transparent);
	}
	.attribution {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0 1.5rem;
		margin-top: 2rem;
	}
	.notes-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.85rem;
		color: var(--muted);
	}
	.preview {
		background: var(--wash);
		padding: 0.75rem 1rem;
		border-radius: var(--radius);
	}
	details {
		margin: 0.5rem 0 1.5rem;
	}
	summary {
		cursor: pointer;
		min-height: 2.75rem;
		display: flex;
		align-items: center;
	}
	.style {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0 1.5rem;
		margin-top: 0.75rem;
	}
	.actions {
		display: flex;
		align-items: center;
		gap: 1.5rem;
		flex-wrap: wrap;
	}
	.delete {
		margin-left: auto;
		color: light-dark(#a3241c, #f2a093);
	}
	@media (max-width: 40rem) {
		.attribution,
		.style {
			grid-template-columns: 1fr;
		}
		.actions .button {
			flex: 1 0 100%;
		}
	}
</style>
