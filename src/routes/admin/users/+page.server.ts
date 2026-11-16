import { attempt, fields, requireAdmin } from '#lib/server/admin.ts';
import { createUser, listAccounts, type Role } from '#lib/server/accounts.ts';
import { db, Invalid } from '#lib/server/db.ts';
import type { Actions, PageServerLoad } from './$types';

const ROLES: readonly Role[] = ['user', 'admin'];

export const load: PageServerLoad = ({ locals }) => {
	const me = requireAdmin(locals);
	// Only what the table shows: never a password hash.
	const accounts = listAccounts(db()).map(({ id, name, email, role, created_at, thoughts }) => ({
		id,
		name,
		email,
		role,
		created: created_at.slice(0, 10),
		thoughts,
		you: id === me.id
	}));
	return { accounts };
};

export const actions: Actions = {
	create: async ({ locals, request }) => {
		requireAdmin(locals);
		const { password = '', ...values } = fields(await request.formData());
		const result = await attempt(values, () => {
			const role = values.role as Role;
			if (!ROLES.includes(role)) throw new Invalid('Choose a role.', 'role');
			return createUser(db(), {
				email: values.email ?? '',
				name: values.name ?? '',
				password,
				role
			});
		});
		if (!result.ok) return result.failure;
		return { created: result.value.email };
	}
};
