// Guards and form helpers for the admin dashboard (server-rendered, no client JS).

import { error, fail, redirect } from '@sveltejs/kit';
import type { User } from './accounts.ts';
import { Invalid } from './db.ts';

/**
 * The signed-in admin. Signed out: to the app's sign-in page. Signed in
 * without the role: 404, so the dashboard does not announce itself.
 * Every load and every action calls this; a layout check alone does not
 * guard form actions.
 */
export function requireAdmin(locals: App.Locals): User {
	if (!locals.user) redirect(303, '/account');
	if (locals.user.role !== 'admin') error(404, 'Not found');
	return locals.user;
}

/** Form fields as strings (files and missing fields become ''). */
export function fields(form: FormData): Record<string, string> {
	const out: Record<string, string> = {};
	for (const [key, value] of form) if (typeof value === 'string') out[key] = value;
	return out;
}

/** Runs an action's work, turning `Invalid` into a 400 the page shows next to its field. */
export async function attempt<T>(values: Record<string, string>, work: () => T | Promise<T>) {
	try {
		return { ok: true as const, value: await work() };
	} catch (thrown) {
		if (thrown instanceof Invalid) {
			return {
				ok: false as const,
				failure: fail(400, { error: thrown.message, field: thrown.field ?? null, values })
			};
		}
		throw thrown;
	}
}
