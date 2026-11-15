// Makes the whole reading app available offline after one visit (see
// `src/service-worker/index.ts`). The worker caches app code as it is fetched,
// so once it controls the page we hand it what loaded before it did, then fetch
// every app route's code through it. Admin routes are not in the `(app)` group
// and are never fetched.

import { preloadCode } from '$app/navigation';
import { routes } from '$app/manifest';

const IMMUTABLE = '/_app/immutable/';

function warm(worker: ServiceWorker): void {
	const loaded = performance
		.getEntriesByType('resource')
		.map((entry) => entry.name)
		.filter((url) => new URL(url).pathname.startsWith(IMMUTABLE));
	worker.postMessage({ type: 'cache', urls: loaded });
	for (const route of routes) {
		if (route.page && route.id.startsWith('/(app)')) void preloadCode(route.id).catch(() => {});
	}
}

export function makeAvailableOffline(): void {
	const container = navigator.serviceWorker;
	if (!container) return;
	if (container.controller) {
		warm(container.controller);
		return;
	}
	// First visit: the worker claims this page when it activates.
	container.addEventListener(
		'controllerchange',
		() => {
			if (container.controller) warm(container.controller);
		},
		{ once: true }
	);
}
