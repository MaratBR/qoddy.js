import { requireAdmin } from '#lib/server/admin.ts';
import { backup, db } from '#lib/server/db.ts';
import type { RequestHandler } from './$types';

/** Downloads a snapshot of the SQLite database. Admins only. */
export const GET: RequestHandler = ({ locals }) => {
	requireAdmin(locals);
	const date = new Date().toISOString().slice(0, 10);
	return new Response(backup(db()), {
		headers: {
			'content-type': 'application/vnd.sqlite3',
			'content-disposition': `attachment; filename="qoddy-${date}.db"`,
			'cache-control': 'no-store'
		}
	});
};
