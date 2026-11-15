import { redirect } from '@sveltejs/kit';
import { attempt, fields, requireAdmin } from '#lib/server/admin.ts';
import { createCollection, listCollections } from '#lib/server/collections.ts';
import { db } from '#lib/server/db.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	requireAdmin(locals);
	return { collections: listCollections(db()) };
};

export const actions: Actions = {
	create: async ({ locals, request }) => {
		requireAdmin(locals);
		const values = fields(await request.formData());
		const result = await attempt(values, () =>
			createCollection(db(), {
				slug: values.slug,
				name: values.name,
				description: values.description
			})
		);
		if (!result.ok) return result.failure;
		redirect(303, `/admin/c/${result.value.slug}`);
	}
};
