<script lang="ts" module>
	/** Colors chosen to sit well in every theme, light or dark. */
	const PRESETS = [
		{ name: 'violet', hex: '#6b4fa8' },
		{ name: 'blue', hex: '#2f5d9e' },
		{ name: 'teal', hex: '#1f7a72' },
		{ name: 'green', hex: '#4a7a32' },
		{ name: 'ochre', hex: '#b5832a' },
		{ name: 'terracotta', hex: '#bb5a35' },
		{ name: 'crimson', hex: '#ad3446' },
		{ name: 'rose', hex: '#b4577f' },
		{ name: 'slate', hex: '#56606e' }
	] as const;

	interface Hsv {
		/** 0–360 */
		h: number;
		/** 0–1 */
		s: number;
		/** 0–1 */
		v: number;
	}

	function toHsv(hex: string): Hsv {
		const [r, g, b] = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16) / 255);
		const max = Math.max(r, g, b);
		const range = max - Math.min(r, g, b);
		const h =
			range === 0
				? 0
				: max === r
					? ((g - b) / range + 6) % 6
					: max === g
						? (b - r) / range + 2
						: (r - g) / range + 4;
		return { h: h * 60, s: max === 0 ? 0 : range / max, v: max };
	}

	function toHex({ h, s, v }: Hsv): string {
		const channel = (n: number) => {
			const k = (n + h / 60) % 6;
			const value = v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
			return Math.round(value * 255)
				.toString(16)
				.padStart(2, '0');
		};
		return `#${channel(5)}${channel(3)}${channel(1)}`;
	}

	const clamp = (n: number) => Math.min(1, Math.max(0, n));
</script>

<script lang="ts">
	// A thought's color: one of a few chosen ones, or any other from a picker
	// (a hue, then saturation and brightness on a field, or a hex code).
	import { untrack } from 'svelte';
	import { dismissable } from '#lib/client/dismiss.ts';
	import { t } from '#lib/client/i18n.svelte.ts';
	import { normalizeColor } from '#lib/thought.ts';

	let { value = $bindable(), label }: { value: string; label: string } = $props();

	const id = $props.id();
	let open = $state(false);
	let custom: HTMLButtonElement | undefined = $state();
	let field: HTMLDivElement | undefined = $state();

	const preset = $derived(PRESETS.some((option) => option.hex === value));

	// The picker keeps its own hue and saturation, so they survive black and
	// gray, where the color alone loses them.
	let hsv = $state(toHsv(value));
	$effect(() => {
		const current = value;
		untrack(() => {
			if (toHex(hsv) !== current) hsv = toHsv(current);
		});
	});
	function pick(next: Hsv) {
		hsv = next;
		value = toHex(next);
	}

	// The hex field follows the color, except while it is being typed in.
	let hex = $state(value);
	let typing = $state(false);
	$effect(() => {
		if (!typing) hex = value;
	});
	function onhexinput() {
		const digits = hex.trim().replace(/^#/, '');
		const full = digits.length === 3 ? digits.replace(/./g, '$&$&') : digits;
		const color = normalizeColor(`#${full}`);
		if (color) value = color;
	}

	function show() {
		open = true;
		requestAnimationFrame(() => field?.focus());
	}
	function hide(refocus = false) {
		open = false;
		if (refocus) custom?.focus();
	}

	function fieldAt(event: PointerEvent) {
		const rect = field!.getBoundingClientRect();
		pick({
			h: hsv.h,
			s: clamp((event.clientX - rect.left) / rect.width),
			v: clamp(1 - (event.clientY - rect.top) / rect.height)
		});
	}
	function onfielddown(event: PointerEvent) {
		field!.setPointerCapture(event.pointerId);
		fieldAt(event);
	}
	function onfieldmove(event: PointerEvent) {
		if (field!.hasPointerCapture(event.pointerId)) fieldAt(event);
	}
	/** Left and right for saturation, up and down for brightness; Shift for bigger steps. */
	function onfieldkeydown(event: KeyboardEvent) {
		const step = event.shiftKey ? 0.1 : 0.01;
		const moves: Record<string, [number, number]> = {
			ArrowLeft: [-step, 0],
			ArrowRight: [step, 0],
			ArrowDown: [0, -step],
			ArrowUp: [0, step]
		};
		const move = moves[event.key];
		if (!move) return;
		event.preventDefault();
		pick({ h: hsv.h, s: clamp(hsv.s + move[0]), v: clamp(hsv.v + move[1]) });
	}

	function onkeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && open) {
			event.preventDefault();
			hide(true);
		}
	}

	const percent = (n: number) => Math.round(n * 100);
</script>

<!-- svelte-ignore a11y_no_static_element_interactions (Escape closes the picker from inside it) -->
<div class="color-picker" {onkeydown} {@attach open && dismissable(() => hide())}>
	<div class="swatches" role="radiogroup" aria-label={label}>
		{#each PRESETS as option (option.hex)}
			<input
				type="radio"
				name="{id}-color"
				class="swatch"
				style:--swatch={option.hex}
				checked={value === option.hex}
				onchange={() => (value = option.hex)}
				aria-label={t.write.colors[option.name]}
				title={t.write.colors[option.name]}
			/>
		{/each}
		<button
			bind:this={custom}
			type="button"
			class={['swatch', 'custom', { chosen: !preset }]}
			style:--swatch={preset ? null : value}
			aria-label={t.write.otherColor}
			title={t.write.otherColor}
			aria-haspopup="dialog"
			aria-expanded={open}
			aria-controls="{id}-picker"
			onclick={() => (open ? hide() : show())}
		></button>
	</div>

	<div
		id="{id}-picker"
		class="picker"
		role="dialog"
		aria-label={t.write.otherColor}
		hidden={!open}
		style:--hue={hsv.h}
		style:--color={value}
	>
		<div
			bind:this={field}
			class="area"
			role="slider"
			tabindex="0"
			aria-label={t.write.saturationBrightness}
			aria-valuemin={0}
			aria-valuemax={100}
			aria-valuenow={percent(hsv.s)}
			aria-valuetext={t.write.saturationBrightnessValue(percent(hsv.s), percent(hsv.v))}
			onpointerdown={onfielddown}
			onpointermove={onfieldmove}
			onkeydown={onfieldkeydown}
		>
			<span class="thumb" style:left="{hsv.s * 100}%" style:top="{(1 - hsv.v) * 100}%"></span>
		</div>
		<input
			class="hue"
			type="range"
			min="0"
			max="359"
			step="1"
			value={Math.round(hsv.h)}
			oninput={(event) => pick({ ...hsv, h: event.currentTarget.valueAsNumber })}
			aria-label={t.write.hue}
		/>
		<label class="hex">
			<span class="preview" aria-hidden="true"></span>
			<span class="visually-hidden">{t.write.hex}</span>
			<input
				bind:value={hex}
				oninput={onhexinput}
				onfocus={() => (typing = true)}
				onblur={() => (typing = false)}
				maxlength="7"
				spellcheck="false"
				autocomplete="off"
			/>
		</label>
	</div>
</div>

<style>
	.color-picker {
		position: relative;
		display: inline-block;
		max-width: 100%;
	}

	/* --- The swatches: dots of color, the chosen one ringed. ---------------- */

	.swatches {
		display: flex;
		flex-wrap: wrap;
		gap: 0.55rem;
		padding: 0.3rem;
		margin: -0.3rem;
	}
	.swatch {
		appearance: none;
		flex: none;
		position: relative;
		width: 2rem;
		height: 2rem;
		min-height: 0;
		margin: 0;
		padding: 0;
		border: 0;
		border-radius: 50%;
		background: var(--swatch);
		/* A hairline keeps dark colors visible on dark paper. */
		box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--ink) 14%, transparent);
		cursor: pointer;
		transition:
			box-shadow 0.2s var(--ease),
			scale 0.3s var(--ease);
	}
	@media (hover: hover) {
		.swatch:hover {
			scale: 1.08;
		}
	}
	.swatch:active {
		scale: 0.92;
		transition-duration: 0.08s;
	}
	/* Chosen: a ring of the paper, then one of the color itself. */
	.swatch:checked,
	.swatch.chosen {
		box-shadow:
			inset 0 0 0 1px color-mix(in oklab, var(--ink) 14%, transparent),
			0 0 0 2.5px var(--paper),
			0 0 0 4.5px var(--swatch);
	}
	.swatch:focus-visible {
		outline-offset: 5px;
	}
	/* Another color: every hue round a white center, until one is chosen. */
	.custom {
		background:
			radial-gradient(circle, #fff 0 22%, transparent 24%),
			conic-gradient(
				from 90deg,
				oklch(0.65 0.2 30),
				oklch(0.75 0.17 90),
				oklch(0.7 0.18 150),
				oklch(0.65 0.15 220),
				oklch(0.55 0.2 280),
				oklch(0.6 0.22 340),
				oklch(0.65 0.2 30)
			);
	}
	.custom.chosen {
		background:
			radial-gradient(circle, var(--swatch) 0 52%, transparent 54%),
			conic-gradient(
				from 90deg,
				oklch(0.65 0.2 30),
				oklch(0.75 0.17 90),
				oklch(0.7 0.18 150),
				oklch(0.65 0.15 220),
				oklch(0.55 0.2 280),
				oklch(0.6 0.22 340),
				oklch(0.65 0.2 30)
			);
	}

	/* --- The picker: a sheet under the swatches. ------------------------------ */

	.picker {
		position: absolute;
		z-index: 2;
		inset-inline-end: 0;
		top: calc(100% + 0.75rem);
		display: grid;
		gap: 0.85rem;
		width: min(16.5rem, calc(100vw - 2.5rem));
		padding: 0.85rem;
		border-radius: calc(var(--radius) + 8px);
		background: light-dark(
			color-mix(in oklab, var(--paper) 30%, #fff),
			color-mix(in oklab, var(--ink) 14%, var(--paper))
		);
		box-shadow:
			0 0 0 1px color-mix(in oklab, var(--ink) 10%, transparent),
			0 2px 4px color-mix(in oklab, #000 8%, transparent),
			var(--lift);
		transform-origin: top right;
		transition:
			opacity 0.18s var(--ease),
			scale 0.25s var(--ease),
			display 0.25s allow-discrete;
		@starting-style {
			opacity: 0;
			scale: 0.96;
		}
	}
	.picker[hidden] {
		display: none;
		opacity: 0;
		scale: 0.96;
	}

	/* Saturation runs left to right, brightness bottom to top, at the hue. */
	.area {
		position: relative;
		aspect-ratio: 3 / 2;
		border-radius: calc(var(--radius) + 2px);
		background:
			linear-gradient(to top, #000, transparent),
			linear-gradient(to right, #fff, hsl(var(--hue) 100% 50%));
		box-shadow: inset 0 0 0 1px color-mix(in oklab, #000 10%, transparent);
		cursor: crosshair;
		touch-action: none;
	}
	.thumb {
		position: absolute;
		width: 1.25rem;
		height: 1.25rem;
		translate: -50% -50%;
		border-radius: 50%;
		background: var(--color);
		box-shadow:
			0 0 0 2.5px #fff,
			0 1px 4px 2px color-mix(in oklab, #000 30%, transparent);
		pointer-events: none;
	}
	.area:focus-visible {
		outline-offset: 3px;
	}

	.hue {
		appearance: none;
		width: 100%;
		height: 1rem;
		min-height: 0;
		margin: 0.15rem 0;
		padding: 0;
		border: 0;
		border-radius: 999px;
		background: linear-gradient(
			to right,
			hsl(0 100% 50%),
			hsl(60 100% 50%),
			hsl(120 100% 50%),
			hsl(180 100% 50%),
			hsl(240 100% 50%),
			hsl(300 100% 50%),
			hsl(360 100% 50%)
		);
		box-shadow: inset 0 0 0 1px color-mix(in oklab, #000 10%, transparent);
		cursor: pointer;
	}
	.hue:focus-visible {
		outline: 3px solid color-mix(in oklab, var(--accent) 55%, transparent);
		outline-offset: 3px;
		box-shadow: inset 0 0 0 1px color-mix(in oklab, #000 10%, transparent);
	}
	.hue::-webkit-slider-thumb {
		appearance: none;
		width: 1.25rem;
		height: 1.25rem;
		border-radius: 50%;
		background: hsl(var(--hue) 100% 50%);
		box-shadow:
			0 0 0 2.5px #fff,
			0 1px 4px 2px color-mix(in oklab, #000 30%, transparent);
	}
	.hue::-moz-range-thumb {
		width: 1.25rem;
		height: 1.25rem;
		border: 0;
		border-radius: 50%;
		background: hsl(var(--hue) 100% 50%);
		box-shadow:
			0 0 0 2.5px #fff,
			0 1px 4px 2px color-mix(in oklab, #000 30%, transparent);
	}

	.hex {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}
	.preview {
		flex: none;
		width: 2.75rem;
		height: 2.75rem;
		border-radius: calc(var(--radius) + 2px);
		background: var(--color);
		box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--ink) 14%, transparent);
	}
	.hex input {
		font-variant-numeric: tabular-nums;
		letter-spacing: 0.04em;
		text-transform: lowercase;
	}
</style>
