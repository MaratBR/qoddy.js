// Themes are token sets in `styles/themes.css`, selected by `data-theme`. A
// theme decides the paper, ink, faces and shapes, in a light and a dark
// version; the reader's mode picks between them and the reader's color sets
// the accent. Ids are stored in accounts, settings and thoughts: never rename one.

export interface Theme {
	id: string;
	name: string;
	/** Paper (and browser chrome) in light mode. */
	light: string;
	/** Paper (and browser chrome) in dark mode. */
	dark: string;
}

/** The first theme is the fallback default. */
export const THEMES: readonly Theme[] = [
	{ id: 'morning', name: 'Neutral', light: '#e8ece6', dark: '#151a17' },
	{ id: 'book', name: 'Book', light: '#f2ead9', dark: '#1c1814' },
	{ id: 'vesper', name: 'Salon', light: '#f5f0e6', dark: '#231b2c' },
	{ id: 'field', name: 'Confetti', light: '#f4eec8', dark: '#1b1c30' }
];

export function findTheme(id: string | null | undefined): Theme | undefined {
	return THEMES.find((theme) => theme.id === id);
}

export function themeExists(id: string): boolean {
	return findTheme(id) !== undefined;
}
