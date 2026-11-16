// How the current page asks to be set: a thought's own theme, color and font
// override the reader's choice while it is on screen. The app layout applies
// this to <html>.

import type { ThoughtFields } from '../thought.ts';

type Look = Pick<ThoughtFields, 'theme' | 'color' | 'font'>;

export const look = $state<Look>({ theme: null, color: null, font: null });

/** Shows the thought's look while the calling component is mounted. Call during init. */
export function useLook(source: () => Look | null | undefined): void {
	$effect(() => {
		const value = source();
		look.theme = value?.theme ?? null;
		look.color = value?.color ?? null;
		look.font = value?.font ?? null;
		return () => {
			look.theme = look.color = look.font = null;
		};
	});
}

/** A Google Fonts stylesheet for a validated family name. */
export function fontHref(family: string): string {
	return `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}&display=swap`;
}

/** A color token (`--paper`) as the page resolves it now, light-dark() and color-mix() included. */
export function resolveColor(token: string): string {
	const probe = document.createElement('span');
	probe.style.cssText = `position:absolute;visibility:hidden;color:var(${token})`;
	document.body.append(probe);
	const color = getComputedStyle(probe).color;
	probe.remove();
	return color;
}

/** A CSS color as `#rrggbb` (what browser chrome understands everywhere), or as given if the canvas cannot read it. */
export function toHex(color: string): string {
	const context = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
	if (!context) return color;
	context.fillStyle = '#010203';
	context.fillStyle = color;
	if (context.fillStyle === '#010203') return color;
	context.fillRect(0, 0, 1, 1);
	const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
	return `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}
