import type { RequestHandler } from './$types';
import { db, Invalid } from '#lib/server/db.ts';
import { invalid, NO_STORE, readJson } from '#lib/server/http.ts';
import { parseSyncRequest, sync } from '#lib/server/sync.ts';

/** Pushes this device's personal changes and pulls everything it lacks (see `sync.ts`). */
export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const body = parseSyncRequest(await readJson(request));
		return Response.json(sync(db(), locals.user, body), { headers: NO_STORE });
	} catch (error) {
		if (error instanceof Invalid) return invalid(error);
		throw error;
	}
};
