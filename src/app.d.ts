// See https://svelte.dev/docs/kit/types#app.d.ts
import type { User } from '#lib/server/accounts.ts';

declare global {
	namespace App {
		interface Locals {
			/** The signed-in user, from the session cookie. */
			user: User | null;
		}
	}
}

export {};
