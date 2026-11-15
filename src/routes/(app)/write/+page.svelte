<script lang="ts">
	// Write a thought of your own, or edit one (`?id=`). The editor is the page
	// the thought will be: its text set as it reads, the attribution under it,
	// and notes and style folded away until wanted. Style choices restyle the
	// page as you make them.
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { library, LibraryError } from '#lib/client/library.svelte.ts';
	import { useLook } from '#lib/client/look.svelte.ts';
	import { LIMITS, normalizeColor, sizeClass, validFont } from '#lib/thought.ts';
	import { THEMES } from '#lib/themes.ts';
	import Unlock from '#lib/components/Unlock.svelte';
	import NotesEditor from '#lib/components/NotesEditor.svelte';
	import { t } from '#lib/client/i18n.svelte.ts';

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

	let notesOpen = $state(Boolean(existing?.notes));
	let styleOpen = $state(
		Boolean(existing?.theme || existing?.color || existing?.font || existing?.lang)
	);

	let error = $state<{ message: string; field?: string } | null>(null);
	let saving = $state(false);
	let textarea: HTMLTextAreaElement | undefined = $state();

	useLook(() => ({
		theme: theme || null,
		color: colored ? normalizeColor(color) : null,
		// Load a font only once it is a plausible family name.
		font: validFont(font.trim()) ? font.trim() : null
	}));

	// A new thought starts with the cursor in it.
	$effect(() => {
		if (!existing) textarea?.focus();
	});

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
					: { message: t.write.couldNotSave };
			if (error.field === 'notes') notesOpen = true;
			if (error.field === 'font' || error.field === 'lang') styleOpen = true;
		} finally {
			saving = false;
		}
	}

	/** Ctrl or ⌘ + Enter saves from anywhere in the form, notes included. */
	function onkeydowncapture(event: KeyboardEvent & { currentTarget: HTMLFormElement }) {
		if (event.key !== 'Enter' || !(event.ctrlKey || event.metaKey)) return;
		event.preventDefault();
		event.stopPropagation();
		if (!saving) event.currentTarget.requestSubmit();
	}

	async function remove() {
		if (!existing || !confirm(t.write.deleteConfirm)) return;
		await library.deleteMine(existing.id);
		await goto('/c/mine/all');
	}

	const fieldError = (field: string) => (error?.field === field ? error.message : null);
	const INLINE_ERRORS = ['text', 'notes', 'font', 'lang'];
</script>

<svelte:head>
	<title
		>{existing ? t.write.editTitle : t.common.writeAThought} · {library.settings.site_name}</title
	>
</svelte:head>

<main>
	{#if id && !existing}
		{#if library.locked && library.sealed > 0}
			<Unlock />
		{:else}
			<h1>{t.common.notOnDevice}</h1>
			<p>{t.write.notAmongYours} <a href="/c/mine/all">{t.write.seeYours}</a></p>
		{/if}
	{:else if library.signedIn && library.locked}
		<Unlock />
	{:else}
		<form onsubmit={save} {onkeydowncapture} novalidate>
			<div class="page">
				<label>
					<span class="visually-hidden">{t.write.label}</span>
					<textarea
						bind:this={textarea}
						class={['thought-type', sizeClass(text || 'x')]}
						bind:value={text}
						lang={lang || undefined}
						dir="auto"
						rows="1"
						maxlength={LIMITS.text}
						placeholder={t.write.placeholder}
						aria-invalid={fieldError('text') ? true : undefined}></textarea>
				</label>
				{#if fieldError('text')}<p class="error" role="alert">{fieldError('text')}</p>{/if}

				<!-- Set like the attribution under a thought: “— author, source”. -->
				<p class="attribution" lang={lang || undefined} dir="auto">
					<span class="dash" aria-hidden="true">—</span>
					<input
						class="author"
						bind:value={author}
						maxlength={LIMITS.author}
						placeholder={t.write.author}
						aria-label={t.write.author}
						aria-describedby="author-hint"
					/>{#if author.trim() && source.trim()}<span class="comma" aria-hidden="true">,</span>{/if}
					<input
						class="source"
						bind:value={source}
						maxlength={LIMITS.source}
						placeholder={t.write.source}
						aria-label={t.write.source}
						aria-describedby="source-hint"
					/>
				</p>
				<p class="hint attribution-hint">
					<span id="author-hint">{t.write.authorHint}</span>
					<span id="source-hint">{t.write.sourceHint}</span>
				</p>

				<div class="more">
					<button
						type="button"
						class="link"
						aria-expanded={notesOpen}
						aria-controls="notes"
						onclick={() => (notesOpen = !notesOpen)}>{t.write.notes}</button
					>
					<button
						type="button"
						class="link"
						aria-expanded={styleOpen}
						aria-controls="style"
						onclick={() => (styleOpen = !styleOpen)}>{t.write.style}</button
					>
				</div>

				<!-- Kept mounted while hidden, so the editor keeps its undo history. -->
				<section id="notes" class="panel" hidden={!notesOpen} lang={lang || undefined}>
					<NotesEditor bind:value={notes} label={t.write.notes} />
					{#if fieldError('notes')}<p class="error" role="alert">{fieldError('notes')}</p>{/if}
				</section>

				<section id="style" class="panel" hidden={!styleOpen}>
					<div class="style">
						<label class="field">
							<span>{t.write.theme}</span>
							<select bind:value={theme}>
								<option value="">{t.write.readersTheme}</option>
								{#each THEMES as option (option.id)}
									<option value={option.id}>{t.themes[option.id] ?? option.name}</option>
								{/each}
							</select>
						</label>
						<div class="field">
							<label class="check"
								><input type="checkbox" bind:checked={colored} /> {t.write.ownColor}</label
							>
							{#if colored}<input type="color" bind:value={color} aria-label={t.write.color} />{/if}
						</div>
						<label class="field">
							<span>{t.write.font}</span>
							<input bind:value={font} placeholder={t.write.fontHint} />
							{#if fieldError('font')}<span class="error">{fieldError('font')}</span>{/if}
						</label>
						<label class="field">
							<span>{t.write.language}</span>
							<input bind:value={lang} placeholder={t.write.languageHint} />
							{#if fieldError('lang')}<span class="error">{fieldError('lang')}</span>{/if}
						</label>
					</div>
				</section>
			</div>

			<footer>
				{#if error && !INLINE_ERRORS.includes(error.field ?? '')}
					<p class="error" role="alert">{error.message}</p>
				{/if}
				<div class="actions">
					<button
						class="button"
						disabled={saving}
						aria-keyshortcuts="Control+Enter Meta+Enter"
						title="Ctrl/⌘ + Enter">{saving ? t.write.saving : t.write.save}</button
					>
					<a class="link" href={existing ? `/t/${existing.id}` : '/c/mine'}>{t.write.cancel}</a>
					{#if existing}
						<button type="button" class="link delete" onclick={remove}>{t.write.delete}</button>
					{/if}
				</div>
				{#if !library.signedIn}
					<p class="hint">
						{t.write.savedLocal} <a href="/account">{t.write.signIn}</a>{t.write.signInTail}
					</p>
				{:else if library.lock}
					<p class="hint">{t.write.encrypted}</p>
				{/if}
			</footer>
		</form>
	{/if}
</main>

<style>
	/* The same margins as a thought's own page, so it does not move on saving. */
	main {
		flex: 1;
		display: flex;
		flex-direction: column;
		padding: clamp(1.5rem, 6vh, 4rem) clamp(1.25rem, 8vw, 7rem) 0;
	}
	form {
		flex: 1;
		display: grid;
		grid-template-rows: 1fr auto;
	}
	.page {
		max-width: 64rem;
		padding-top: clamp(0rem, 8vh - 2rem, 4rem);
	}

	textarea.thought-type {
		display: block;
		width: 100%;
		min-height: 0;
		padding: 0;
		background: none;
		border: 0;
		border-radius: 0;
		field-sizing: content;
		resize: none;
		transition: font-size 0.3s ease;
	}
	/* It grows with its text; where it cannot, it starts a few lines tall. */
	@supports (field-sizing: content) {
		textarea.thought-type {
			overflow: hidden;
		}
	}
	@supports not (field-sizing: content) {
		textarea.thought-type {
			min-height: 3lh;
		}
	}
	/* The caret shows where you are; nothing else needs to. */
	textarea.thought-type:focus-visible {
		box-shadow: none;
	}
	textarea.thought-type::placeholder {
		color: color-mix(in oklab, var(--muted) 60%, transparent);
	}

	.attribution {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0 0.3em;
		margin: clamp(1.25rem, 3vh, 2rem) 0 0;
		font-size: 1.15rem;
	}
	.dash {
		color: var(--muted);
	}
	/* The comma sits against the author, as it reads. */
	.comma {
		margin-inline-start: -0.3em;
	}
	.attribution input {
		width: auto;
		min-width: 4ch;
		max-width: 100%;
		min-height: 2.75rem;
		field-sizing: content;
		padding: 0;
		background: none;
		border: 0;
		border-radius: 0;
		line-height: inherit;
	}
	/* Fields where field-sizing is unknown share the line. */
	@supports not (field-sizing: content) {
		.attribution input {
			flex: 1 1 12rem;
		}
	}
	.attribution input:focus-visible {
		box-shadow: inset 0 -1px 0 var(--accent);
	}
	.attribution input::placeholder {
		color: color-mix(in oklab, var(--muted) 70%, transparent);
	}
	.attribution .source {
		font-style: italic;
		color: var(--muted);
	}

	/* Each field's hint shows while it has focus; the line keeps its place. */
	.attribution-hint {
		display: grid;
		min-height: 1lh;
	}
	.attribution-hint span {
		grid-area: 1 / 1;
		visibility: hidden;
	}
	.page:has(.author:focus) #author-hint,
	.page:has(.source:focus) #source-hint {
		visibility: visible;
	}

	.more {
		display: flex;
		gap: 1.5rem;
		margin-top: 1rem;
	}
	.more .link {
		color: var(--muted);
		text-decoration: none;
	}
	.more .link:hover,
	.more .link[aria-expanded='true'] {
		color: var(--ink);
	}
	.more .link::after {
		content: '+';
		margin-inline-start: 0.1em;
	}
	.more .link[aria-expanded='true']::after {
		content: '−';
	}

	.panel {
		max-width: 40rem;
		margin-top: 0.5rem;
	}
	.style {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0 1.5rem;
		padding-top: 1rem;
		border-top: 1px solid var(--rule);
	}

	footer {
		padding: 2.5rem 0 max(1rem, env(safe-area-inset-bottom));
	}
	.actions {
		display: flex;
		align-items: center;
		gap: 1.5rem;
		flex-wrap: wrap;
		margin-bottom: 0.5rem;
	}
	.delete {
		margin-inline-start: auto;
		color: light-dark(#a3241c, #f2a093);
	}
	@media (max-width: 40rem) {
		main {
			padding: 1rem 1.25rem 0;
		}
		.style {
			grid-template-columns: 1fr;
		}
	}
</style>
