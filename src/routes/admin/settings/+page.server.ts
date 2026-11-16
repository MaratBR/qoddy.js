import { attempt, fields, requireAdmin } from '#lib/server/admin.ts';
import { db } from '#lib/server/db.ts';
import { listCollections, MINE_SLUG } from '#lib/server/collections.ts';
import { getSettings, homeFromSlug, updateSettings } from '#lib/server/settings.ts';
import { THEMES } from '#lib/themes.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	requireAdmin(locals);
	const settings = getSettings(db());
	const collections = listCollections(db());
	const home = collections.find((c) => c.id === settings.home)?.slug ?? MINE_SLUG;
	return { settings, home, mine: MINE_SLUG, collections, themes: THEMES };
};

export const actions: Actions = {
	default: async ({ locals, request }) => {
		requireAdmin(locals);
		const values = fields(await request.formData());
		const result = await attempt(values, () =>
			updateSettings(db(), {
				site_name: values.site_name ?? '',
				default_theme: values.default_theme ?? '',
				allow_sign_up: values.allow_sign_up === 'on',
				home: homeFromSlug(db(), values.home ?? ''),
				hide_from_search: values.hide_from_search === 'on'
			})
		);
		if (!result.ok) return result.failure;
		return { saved: true };
	}
};
