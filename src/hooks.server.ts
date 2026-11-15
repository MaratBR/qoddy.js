import type { Handle } from '@sveltejs/kit/hooks';
import { db } from '#lib/server/db.ts';
import { sessionUser } from '#lib/server/accounts.ts';
import { clearSessionCookie, SESSION_COOKIE, setSessionCookie } from '#lib/server/http.ts';

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.user = null;
	const token = event.cookies.get(SESSION_COOKIE);
	if (token) {
		const session = sessionUser(db(), token);
		if (session) {
			event.locals.user = session.user;
			if (session.renewed) setSessionCookie(event.cookies, token, session.renewed);
		} else {
			clearSessionCookie(event.cookies);
		}
	}

	// SvelteKit checks the origin of form posts. API writes must also be JSON
	// from this origin: cross-site pages cannot send JSON without a CORS
	// preflight, which this server never grants.
	if (event.url.pathname.startsWith('/api/') && event.request.method !== 'GET') {
		const json = event.request.headers.get('content-type')?.startsWith('application/json');
		const origin = event.request.headers.get('origin');
		if (!json || (origin !== null && origin !== event.url.origin)) {
			return new Response('Forbidden', { status: 403 });
		}
	}

	const response = await resolve(event);
	response.headers.set('x-content-type-options', 'nosniff');
	response.headers.set('referrer-policy', 'strict-origin-when-cross-origin');
	response.headers.set('x-frame-options', 'DENY');
	return response;
};
