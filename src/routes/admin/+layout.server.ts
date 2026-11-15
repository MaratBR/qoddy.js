import { requireAdmin } from '#lib/server/admin.ts';
import { db } from '#lib/server/db.ts';
import { getSettings } from '#lib/server/settings.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => {
	const user = requireAdmin(locals);
	return { user: { name: user.name }, siteName: getSettings(db()).site_name };
};
