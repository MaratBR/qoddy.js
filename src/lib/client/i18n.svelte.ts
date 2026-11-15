// The reading app's language. A signed-in reader's choice is saved to their
// account (the library syncs it, as with the theme); otherwise it is this
// device's choice, else the first of the browser's languages the app speaks,
// else English. `t` is the current catalog: reading from it in a component
// re-renders on a change.
//
// To add a language, list it in `#lib/locales.ts` and add its catalog, typed
// `Messages`, under `locales/`.

import { findLocale, LOCALES, matchLocale, type Locale } from '../locales.ts';
import { en, type Messages } from './locales/en.ts';
import { ru } from './locales/ru.ts';
import { store, stored } from './storage.ts';

const CATALOGS: Record<Locale, Messages> = { en, ru };

const KEY = 'qoddy.locale';

/** The browser's preferred language, among those the app speaks. */
export function browserLocale(): Locale {
	return matchLocale(typeof navigator === 'undefined' ? [] : navigator.languages) ?? LOCALES[0].id;
}

class I18n {
	locale = $state<Locale>(findLocale(stored(KEY)) ?? browserLocale());

	/** Shows the app in `id` and remembers it on this device; unknown ids are ignored. */
	set(id: string | null | undefined): void {
		const locale = findLocale(id);
		if (!locale) return;
		this.locale = locale;
		store(KEY, locale);
	}
}

export const i18n = new I18n();

export const t: Messages = new Proxy({} as Messages, {
	get: (_, key) => CATALOGS[i18n.locale][key as keyof Messages]
});
