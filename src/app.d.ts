// See https://svelte.dev/docs/kit/types#app.d.ts
import type { User } from '#lib/server/accounts.ts';

declare global {
	/** Set by `vite.config.ts` at build time: when the code was built, and from which commit. */
	const __QODDY_BUILD__: { built: string; commit: string };

	namespace App {
		interface Locals {
			/** The signed-in user, from the session cookie. */
			user: User | null;
		}
	}
}

export {};
