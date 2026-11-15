// Themes are token sets in `styles/themes.css`, selected by `<html data-theme>`.
// A theme with `dark` follows the device's light/dark mode (or the reader's
// explicit choice); one without is always shown as designed.

export interface Theme {
	id: string;
	name: string;
	/** Browser chrome color in light mode (or the only mode). */
	light: string;
	/** Browser chrome color in dark mode, if the theme has one. */
	dark?: string;
}

/** The first theme is the fallback default. */
export const THEMES: readonly Theme[] = [
	{ id: 'dawn', name: 'Dawn', light: '#f4ede4', dark: '#1d1a1f' },
	{ id: 'nocturne', name: 'Nocturne', light: '#121527' },
	{ id: 'studio', name: 'Studio', light: '#f3f3f0', dark: '#111111' }
];

export function findTheme(id: string | null | undefined): Theme | undefined {
	return THEMES.find((theme) => theme.id === id);
}

export function themeExists(id: string): boolean {
	return findTheme(id) !== undefined;
}
