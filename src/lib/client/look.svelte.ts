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
