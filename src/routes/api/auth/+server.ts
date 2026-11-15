import type { RequestHandler } from './$types';
import { db, Invalid } from '#lib/server/db.ts';
import { authenticate, createSession, deleteSession, signUp } from '#lib/server/accounts.ts';
import {
	clearSessionCookie,
	invalid,
	NO_STORE,
	readJson,
	SESSION_COOKIE,
	setSessionCookie
} from '#lib/server/http.ts';

const text = (value: unknown) => (typeof value === 'string' ? value : '');

/**
 * `{ action: 'signin' | 'signup', email, password, name? }` starts a session;
 * `{ action: 'signout' }` ends this one. Answers `{ ok: true }` or an error.
 */
export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		const body = (await readJson(request)) as Record<string, unknown>;
		const action = body?.action;
		if (action === 'signout') {
			const token = cookies.get(SESSION_COOKIE);
			if (token) deleteSession(db(), token);
			clearSessionCookie(cookies);
			return Response.json({ ok: true }, { headers: NO_STORE });
		}
		const credentials = { email: text(body.email), password: text(body.password) };
		let user;
		if (action === 'signin') {
			user = await authenticate(db(), credentials.email, credentials.password);
			if (!user) return invalid(new Invalid('Wrong email or password.', 'password'), 401);
		} else if (action === 'signup') {
			user = await signUp(db(), { ...credentials, name: text(body.name) });
		} else {
			throw new Invalid('Unknown action.');
		}
		const session = createSession(db(), user.id);
		setSessionCookie(cookies, session.token, session.expires);
		return Response.json({ ok: true }, { headers: NO_STORE });
	} catch (error) {
		if (error instanceof Invalid) return invalid(error);
		throw error;
	}
};
