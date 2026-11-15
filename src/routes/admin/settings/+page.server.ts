import { attempt, fields, requireAdmin } from '#lib/server/admin.ts';
import { db } from '#lib/server/db.ts';
import { getSettings, updateSettings } from '#lib/server/settings.ts';
import { THEMES } from '#lib/themes.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	requireAdmin(locals);
	return { settings: getSettings(db()), themes: THEMES };
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
				daily: values.daily === 'on'
			})
		);
		if (!result.ok) return result.failure;
		return { saved: true };
	}
};
