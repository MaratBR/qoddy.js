import { error, fail, redirect } from '@sveltejs/kit';
import { attempt, fields, requireAdmin } from '#lib/server/admin.ts';
import {
	browseThoughts,
	CSV_COLUMNS,
	deleteCollection,
	findCollection,
	importCsv,
	updateCollection
} from '#lib/server/collections.ts';
import { db } from '#lib/server/db.ts';
import type { Actions, PageServerLoad } from './$types';

const MAX_CSV_BYTES = 5 * 1024 * 1024;

function collectionOr404(slug: string) {
	const collection = findCollection(db(), slug);
	if (!collection) error(404, 'Not found');
	return collection;
}

export const load: PageServerLoad = ({ locals, params, url }) => {
	requireAdmin(locals);
	const collection = collectionOr404(params.slug);
	const search = url.searchParams.get('q') ?? '';
	const listing = browseThoughts(db(), collection.id, {
		search,
		page: Number(url.searchParams.get('page')) || 1
	});
	return { collection, listing, search, columns: CSV_COLUMNS, imported: url.searchParams.get('imported') };
};

export const actions: Actions = {
	update: async ({ locals, params, request }) => {
		requireAdmin(locals);
		const collection = collectionOr404(params.slug);
		const values = fields(await request.formData());
		const result = await attempt(values, () =>
			updateCollection(db(), collection.id, {
				slug: values.slug ?? collection.slug,
				name: values.name,
				description: values.description
			})
		);
		if (!result.ok) return result.failure;
		redirect(303, `/admin/c/${result.value.slug}`);
	},

	delete: async ({ locals, params, request }) => {
		requireAdmin(locals);
		const collection = collectionOr404(params.slug);
		const values = fields(await request.formData());
		if (values.confirm !== collection.slug) {
			return fail(400, {
				error: `Type “${collection.slug}” to confirm.`,
				field: 'confirm',
				values
			});
		}
		const result = await attempt(values, () => deleteCollection(db(), collection.id));
		if (!result.ok) return result.failure;
		redirect(303, '/admin');
	},

	import: async ({ locals, params, request }) => {
		requireAdmin(locals);
		const collection = collectionOr404(params.slug);
		const file = (await request.formData()).get('file');
		const values = {};
		if (!(file instanceof File) || file.size === 0) {
			return fail(400, { error: 'Choose a CSV file.', field: 'file', values });
		}
		if (file.size > MAX_CSV_BYTES) {
			return fail(400, { error: 'Keep the file under 5 MB.', field: 'file', values });
		}
		const text = await file.text();
		const result = await attempt(values, () => importCsv(db(), collection.id, text));
		if (!result.ok) {
			// Point at the import form, whatever the row's own field was.
			const data = result.failure.data;
			return fail(400, { ...data, error: data.error, field: 'file' });
		}
		redirect(303, `/admin/c/${collection.slug}?imported=${result.value}`);
	}
};
