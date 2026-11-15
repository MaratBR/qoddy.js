// The languages the reading app speaks. Shared: the server checks a reader's
// saved choice against this list, and the client keeps a catalog for each
// (`client/i18n.svelte.ts`).

/** Each language named in itself, as the picker shows it. The first is the fallback. */
export const LOCALES = [
	{ id: 'en', name: 'English' },
	{ id: 'ru', name: 'Русский' }
] as const;

export type Locale = (typeof LOCALES)[number]['id'];

export function findLocale(id: string | null | undefined): Locale | undefined {
	return LOCALES.find((locale) => locale.id === id)?.id;
}

/** The first language in `tags` (BCP 47, most preferred first) the app speaks. */
export function matchLocale(tags: readonly string[]): Locale | undefined {
	for (const tag of tags) {
		const locale = findLocale(tag.split('-')[0].toLowerCase());
		if (locale) return locale;
	}
	return undefined;
}
