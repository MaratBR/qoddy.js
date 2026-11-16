<script lang="ts">
	// Shows a thought as a picture, drawn on this device in the page's look, in
	// a pop-up with the picture itself and what to do with it: the system's
	// share sheet where it takes files, and saving it as a file. Whether the
	// picture carries the site's name is this device's choice.
	import { library } from '#lib/client/library.svelte.ts';
	import { store, stored } from '#lib/client/storage.ts';
	import { t } from '#lib/client/i18n.svelte.ts';
	import { imageName, thoughtImage } from '#lib/client/thought-image.ts';
	import type { ThoughtFields } from '#lib/thought.ts';
	import Icon from './Icon.svelte';

	let { thought }: { thought: ThoughtFields } = $props();
	let dialog = $state<HTMLDialogElement>();
	let file = $state<File | null>(null);
	let preview = $state<string | null>(null);
	let error = $state<string | null>(null);
	let canShare = $state(false);
	const NAME_KEY = 'qoddy.imageName';
	let signed = $state(stored(NAME_KEY) !== 'off');
	/** Counts openings, so a slow drawing for an earlier one is dropped. */
	let opening = 0;

	function open() {
		dialog?.showModal();
		void draw();
	}

	async function draw() {
		const current = ++opening;
		error = null;
		try {
			// Drawn while the thought is still on the page beneath, in its look.
			const blob = await thoughtImage(thought, {
				siteName: signed ? library.settings.site_name : null
			});
			if (current !== opening) return;
			file = new File([blob], imageName(thought.text), { type: 'image/png' });
			if (preview) URL.revokeObjectURL(preview);
			preview = URL.createObjectURL(blob);
			canShare = Boolean(navigator.canShare?.({ files: [file] }));
		} catch {
			if (current === opening) error = t.thought.couldNotShareImage;
		}
	}

	function sign(on: boolean) {
		signed = on;
		store(NAME_KEY, on ? null : 'off');
		void draw();
	}

	function closed() {
		opening++;
		if (preview) URL.revokeObjectURL(preview);
		preview = null;
		file = null;
		error = null;
	}

	async function share() {
		if (!file) return;
		error = null;
		try {
			await navigator.share({ files: [file] });
		} catch (failure) {
			if (failure instanceof DOMException && failure.name === 'AbortError') return;
			error = t.thought.couldNotShareImage;
		}
	}

	function save() {
		if (!file || !preview) return;
		const link = document.createElement('a');
		link.href = preview;
		link.download = file.name;
		document.body.append(link);
		link.click();
		link.remove();
	}
</script>

<button
	class="icon"
	onclick={open}
	aria-haspopup="dialog"
	aria-label={t.thought.shareImage}
	title={t.thought.shareImage}><Icon name="image" /></button
>

<dialog bind:this={dialog} class="share-image" aria-label={t.thought.shareImage} onclose={closed}>
	<header>
		<p class="title" aria-hidden="true">{t.thought.shareImage}</p>
		<button class="close" onclick={() => dialog?.close()}>{t.menu.close}</button>
	</header>

	<!-- The picture as large as the screen allows, in its own proportions (4:5). -->
	<div class="stage">
		<div class="frame" aria-busy={!preview && !error}>
			{#if preview}
				<!-- A real image: a long press offers the system's own Save and Share. -->
				<img src={preview} alt={thought.text} width="1080" height="1350" />
			{/if}
		</div>
	</div>

	<div class="controls">
		{#if error}<p class="error" role="alert">{error}</p>{/if}
		<label class="switch-row">
			{t.thought.imageSiteName}
			<input
				type="checkbox"
				role="switch"
				checked={signed}
				onchange={(event) => sign(event.currentTarget.checked)}
			/>
		</label>
		<div class="actions">
			{#if canShare}
				<button class="action primary" onclick={share} disabled={!file}
					><span class="disc"><Icon name="share" /></span>{t.thought.share}</button
				>
			{/if}
			<button class="action" class:primary={!canShare} onclick={save} disabled={!file}
				><span class="disc"><Icon name="down" /></span>{t.thought.saveImage}</button
			>
		</div>
	</div>
</dialog>

<style>
	/* A screen of its own, as music apps show a card to share: the picture on a
	   stage of the page's own color (the theme's paper, with the reader's tone
	   or the thought's tint), taken deep so the card stands out on it. Ink
	   inside is white or black, whichever reads on the stage. The picture
	   itself is drawn from the page outside, in the reader's look. */
	.share-image {
		--stage: color-mix(in oklab, var(--paper) 45%, var(--ink));
		width: 100%;
		height: 100%;
		max-width: none;
		max-height: none;
		margin: 0;
		padding: max(0.5rem, env(safe-area-inset-top)) clamp(1.25rem, 5vw, 3rem)
			max(1.5rem, env(safe-area-inset-bottom));
		border: 0;
		background:
			radial-gradient(
				ellipse 80% 60% at 50% 0%,
				color-mix(in oklab, #fff 16%, transparent),
				transparent
			),
			linear-gradient(to bottom, transparent 55%, color-mix(in oklab, #000 22%, transparent)),
			var(--stage);
		overflow: hidden;
	}
	/* The paper's hue, deeper and richer: dark enough under a light card,
	   lifted out of the night under a dark one. In oklab, not oklch: browsers
	   drop the hue of papers this pale, and the stage would turn pink. */
	@supports (color: oklab(from red l a b)) {
		.share-image {
			--stage: light-dark(
				oklab(from var(--paper) 0.42 clamp(-0.09, a * 5, 0.09) clamp(-0.09, b * 5, 0.09)),
				oklab(from var(--paper) 0.5 clamp(-0.09, a * 3.5, 0.09) clamp(-0.09, b * 3.5, 0.09))
			);
		}
	}
	/* A thought's own color, deepened the same way: on its tinted paper the
	   tint is too faint to carry the stage (blue on cream comes out grey). */
	@supports (color: oklab(from red l a b)) {
		:global(:root[data-tinted]) .share-image {
			--stage: light-dark(
				oklab(from var(--thought-color) 0.42 calc(a * 0.75) calc(b * 0.75)),
				oklab(from var(--thought-color) 0.5 calc(a * 0.75) calc(b * 0.75))
			);
		}
	}
	/* The stage's own tokens, set on what sits on it: the page's --paper is
	   read above, so it cannot be replaced on the same element. */
	.share-image > * {
		--ink: #f7f5f0;
		--paper: var(--stage);
		--muted: color-mix(in oklab, var(--ink) 62%, transparent);
		--wash: color-mix(in oklab, var(--ink) 10%, transparent);
		color: var(--ink);
	}
	@supports (color: oklab(from red l a b)) {
		.share-image > * {
			--ink: oklab(from var(--stage) clamp(0.16, (0.7 - l) * 1000, 0.98) 0 0);
		}
	}
	.share-image::backdrop {
		background: transparent;
	}
	.share-image[open] {
		display: grid;
		grid-template-rows: auto minmax(0, 1fr) auto;
		gap: 1rem;
		animation: fade 0.35s ease-out;
	}
	@keyframes fade {
		from {
			opacity: 0;
		}
	}
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		min-height: 3rem;
	}
	.title {
		margin: 0;
		font-family: var(--ui-font);
		font-size: 0.95rem;
		font-weight: 600;
		letter-spacing: -0.005em;
	}
	.close {
		appearance: none;
		border: 0;
		min-height: 2.4rem;
		padding: 0 1rem;
		border-radius: 999px;
		font-family: var(--ui-font);
		font-size: 0.9rem;
		font-weight: 550;
		color: var(--ink);
		background: color-mix(in oklab, var(--ink) 12%, transparent);
		cursor: pointer;
		transition: background-color 0.2s var(--ease);
	}
	.close:hover {
		background: color-mix(in oklab, var(--ink) 18%, transparent);
	}
	/* The card fits the room left between header and controls, either way. */
	.stage {
		container-type: size;
		display: grid;
		place-items: center;
	}
	.frame {
		width: min(100cqw, 100cqh * 0.8, 34rem);
		aspect-ratio: 4 / 5;
		border-radius: calc(var(--radius) + 4px);
		overflow: hidden;
		background: color-mix(in oklab, var(--ink) 8%, transparent);
		box-shadow:
			0 0 0 1px color-mix(in oklab, var(--ink) 10%, transparent),
			0 1.5rem 3.5rem -1rem color-mix(in oklab, #000 70%, transparent),
			0 0 6rem -1rem color-mix(in oklab, #fff 25%, transparent);
		animation: arrive 0.7s var(--ease) both;
	}
	@keyframes arrive {
		from {
			opacity: 0;
			transform: translateY(2rem) scale(0.9) rotate(-2deg);
		}
	}
	.frame[aria-busy='true'] {
		animation:
			arrive 0.7s var(--ease) both,
			pulse 1.2s ease-in-out 0.7s infinite alternate;
	}
	@keyframes pulse {
		to {
			opacity: 0.55;
		}
	}
	img {
		display: block;
		width: 100%;
		height: 100%;
		animation: fade 0.3s ease-out;
	}
	.controls {
		display: grid;
		justify-items: center;
		gap: 1.25rem;
		animation: rise 0.6s var(--ease) 0.12s both;
	}
	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(1rem);
		}
	}
	.error {
		margin: 0;
		text-align: center;
		color: var(--ink);
		font-weight: 600;
	}
	.switch-row {
		width: min(100%, 22rem);
		border-radius: 999px;
		padding-inline-start: 1.1em;
	}
	/* Round actions with their words beneath. */
	.actions {
		display: flex;
		justify-content: center;
		gap: 2rem;
	}
	.action {
		appearance: none;
		background: none;
		border: 0;
		padding: 0;
		display: grid;
		justify-items: center;
		gap: 0.5rem;
		min-width: 4.5rem;
		font-family: var(--ui-font);
		font-size: 0.8rem;
		font-weight: 550;
		color: var(--ink);
		cursor: pointer;
	}
	.disc {
		display: grid;
		place-items: center;
		width: 3.5rem;
		height: 3.5rem;
		border-radius: 50%;
		background: color-mix(in oklab, var(--ink) 14%, transparent);
		transition:
			background-color 0.2s var(--ease),
			transform 0.3s var(--ease);
	}
	.action.primary .disc {
		background: var(--ink);
		color: var(--stage);
		box-shadow: 0 0.5rem 1.25rem -0.5rem color-mix(in oklab, #000 60%, transparent);
	}
	@media (hover: hover) {
		.action:hover:not(:disabled) .disc {
			transform: scale(1.06);
		}
	}
	.action:active:not(:disabled) .disc {
		transform: scale(0.92);
		transition-duration: 0.08s;
	}
	.action:disabled {
		opacity: 0.45;
		cursor: default;
	}
	.action :global(svg) {
		width: 1.4rem;
		height: 1.4rem;
	}

	@media (prefers-reduced-motion: reduce) {
		.share-image[open],
		.frame,
		.frame[aria-busy='true'],
		.controls {
			animation: none;
		}
	}
</style>
