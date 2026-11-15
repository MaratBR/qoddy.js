// HTTP helpers shared by hooks, endpoints and admin pages.

import type { Cookies } from '@sveltejs/kit';
import { Invalid } from './db.ts';
import type { ApiError } from '../wire.ts';

export const SESSION_COOKIE = 'session';

/** HttpOnly, SameSite=Lax; Secure everywhere but plain-HTTP localhost (SvelteKit's default). */
export function setSessionCookie(cookies: Cookies, token: string, expires: Date): void {
	cookies.set(SESSION_COOKIE, token, { path: '/', httpOnly: true, sameSite: 'lax', expires });
}

export function clearSessionCookie(cookies: Cookies): void {
	cookies.delete(SESSION_COOKIE, { path: '/' });
}

/** A JSON error the client shows next to `field`. */
export function invalid(error: Invalid, status = 400): Response {
	const body: ApiError = { error: error.message, field: error.field, code: error.code };
	return Response.json(body, { status });
}

export async function readJson(request: Request): Promise<unknown> {
	try {
		return await request.json();
	} catch {
		throw new Invalid('Malformed request.');
	}
}

export const NO_STORE = { 'cache-control': 'no-store' };
