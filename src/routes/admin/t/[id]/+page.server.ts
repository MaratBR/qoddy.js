import { error, fail, redirect } from '@sveltejs/kit';
import { attempt, fields, requireAdmin } from '#lib/server/admin.ts';
import {
	addThought,
	deleteThought,
	findCollection,
	findThought,
	listCollections,
	updateThought
} from '#lib/server/collections.ts';
import { db } from '#lib/server/db.ts';
import { renderMarkdown } from '#lib/markdown.ts';
import { checkThought } from '#lib/thought.ts';
import { THEMES } from '#lib/themes.ts';
import type { Actions, PageServerLoad } from './$types';

// `/admin/t/new?c=slug` adds a thought; `/admin/t/<id>` edits one.
// "new" is too short to ever be a thought id.
const NEW = 'new';

function thoughtOr404(id: string) {
	const thought = findThought(db(), id);
	if (!thought) error(404, 'Not found');
	return thought;
}

/** The submitted fields as a thought: the color only when "Tint the page" is on. */
function thoughtInput(values: Record<string, string>) {
	return { ...values, color: values.tinted ? values.color : '' };
}

function targetCollection(values: Record<string, string>) {
	return findCollection(db(), values.collection ?? '');
}

export const load: PageServerLoad = ({ locals, params, url }) => {
	requireAdmin(locals);
	const collections = listCollections(db());
	if (params.id === NEW) {
		const slug = url.searchParams.get('c');
		const collection = collections.find((c) => c.slug === slug) ?? collections[0];
		return { thought: null, collection, collections, themes: THEMES };
	}
	const thought = thoughtOr404(params.id);
	const collection = collections.find((c) => c.id === thought.collection_id)!;
	return { thought, collection, collections, themes: THEMES };
};

export const actions: Actions = {
	save: async ({ locals, params, request }) => {
		requireAdmin(locals);
		const values = fields(await request.formData());
		const collection = targetCollection(values);
		if (!collection) {
			return fail(400, { error: 'Choose a collection.', field: 'collection', values });
		}
		const input = thoughtInput(values);
		const result = await attempt(values, () =>
			params.id === NEW
				? addThought(db(), collection.id, input)
				: updateThought(db(), thoughtOr404(params.id).id, collection.id, input)
		);
		if (!result.ok) return result.failure;
		redirect(303, `/admin/c/${collection.slug}`);
	},

	/** Shows the thought and its rendered notes without saving. */
	preview: async ({ locals, request }) => {
		requireAdmin(locals);
		const values = fields(await request.formData());
		const checked = checkThought(thoughtInput(values));
		if (!checked.ok) return fail(400, { error: checked.error, field: checked.field, values });
		const { text, author, source, notes } = checked.value;
		return {
			values,
			preview: { text, author, source, notes: notes ? renderMarkdown(notes) : null }
		};
	},

	delete: async ({ locals, params }) => {
		requireAdmin(locals);
		const thought = thoughtOr404(params.id);
		const collection = listCollections(db()).find((c) => c.id === thought.collection_id);
		deleteThought(db(), thought.id);
		redirect(303, collection ? `/admin/c/${collection.slug}` : '/admin');
	}
};
