// Offline support for the reading app.
//
// The app is a client-rendered shell (`/`) plus code-split route chunks. This
// worker serves the shell for every app navigation and keeps the chunks the app
// uses. It deliberately does not precache all of `immutable`: that list also
// holds the admin dashboard's chunks, which readers never need. Instead:
//
// - install caches the shell, the files it links to and `static/`;
// - immutable files are cached as the app fetches them;
// - once a page is controlled it sends the files it loaded before this worker
//   existed (message "cache") and preloads the other app routes, so a first
//   visit is enough to work offline.
//
// `/api` (sync) and `/admin` (server-rendered, online only) always go to the
// network. Data lives in IndexedDB, not here.

import { self } from '$app/service-worker';
import { version } from '$app/env';
import { assets, immutable } from '$app/manifest';
import { asset, resolve } from '$app/paths';

const SHELL = `shell-${version}`;
/** Fonts never change under their URLs, so they outlive app versions. */
const FONTS = 'fonts';

const SHELL_PATH: string = resolve('/(app)');
/** The base path ('' unless the app is mounted under a prefix). */
const BASE = SHELL_PATH.slice(0, -1);
const IMMUTABLE = `${BASE}/_app/immutable/`;
/** `static/`, less the iOS launch screens: a phone takes its one when the app is installed. */
const STATIC = new Set<string>(
	assets.filter((file) => !file.path.startsWith('splash/')).map((file) => asset(file.path))
);
const MANIFEST = `${BASE}/manifest.webmanifest`;
const ONLINE_ONLY = [`${BASE}/api/`, `${BASE}/admin`, `${BASE}/_app/version.json`];
const FONT_HOSTS = new Set(['fonts.googleapis.com', 'fonts.gstatic.com']);
const LINKED = new RegExp(`${IMMUTABLE.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}[^"'\\s)]+`, 'g');
/** Bundled theme fonts, basic Latin subset (fontsource names them `<family>-latin-<axis>-<style>`). */
const THEME_FONTS = immutable
	.map((file) => `${BASE}/${file.path}`)
	.filter((path) => /-latin-[a-z]+-(normal|italic)\.[\w-]+\.woff2$/.test(path));

self.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(SHELL);
			const shell = await fetch(SHELL_PATH, { cache: 'reload' });
			if (!shell.ok) throw new Error(`Shell responded ${shell.status}`);
			const html = await shell.clone().text();
			// The entry scripts and styles the shell links to.
			const linked = new Set(html.match(LINKED) ?? []);
			await cache.addAll([...STATIC, ...linked]);
			await cache.put(SHELL_PATH, shell);
			// Best effort: the themes' faces for Latin text, so they look right
			// offline. Other scripts are kept once they are first used.
			await Promise.allSettled(THEME_FONTS.map((url) => cacheFirst(new Request(url), FONTS)));
			await self.skipWaiting();
		})()
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			for (const key of await caches.keys()) {
				if (key !== SHELL && key !== FONTS) await caches.delete(key);
			}
			await self.clients.claim();
		})()
	);
});

/** A page asks to keep files it loaded before this worker controlled it. */
self.addEventListener('message', (event) => {
	const data = event.data as { type?: string; urls?: unknown } | null;
	if (data?.type !== 'cache' || !Array.isArray(data.urls)) return;
	const urls = data.urls.filter(
		(url): url is string =>
			typeof url === 'string' &&
			URL.canParse(url) &&
			new URL(url).origin === self.location.origin &&
			new URL(url).pathname.startsWith(IMMUTABLE)
	);
	event.waitUntil(Promise.all(urls.map((url) => cacheFirst(new Request(url), cacheFor(url)))));
});

function cacheFor(url: string): string {
	return /\.(woff2?|ttf|otf)$/.test(new URL(url).pathname) ? FONTS : SHELL;
}

async function cacheFirst(request: Request, name: string): Promise<Response> {
	const cache = await caches.open(name);
	const cached = await cache.match(request);
	if (cached) return cached;
	const response = await fetch(request);
	// Opaque responses (cross-origin fonts) report status 0 but are usable.
	if (response.ok || response.type === 'opaque') await cache.put(request, response.clone());
	return response;
}

/** Fresh when online, the last copy when not. */
async function networkFirst(request: Request): Promise<Response> {
	const cache = await caches.open(SHELL);
	try {
		const response = await fetch(request);
		if (response.ok) await cache.put(request, response.clone());
		return response;
	} catch (error) {
		const cached = await cache.match(request);
		if (cached) return cached;
		throw error;
	}
}

async function shell(): Promise<Response> {
	const cached = await (await caches.open(SHELL)).match(SHELL_PATH);
	return cached ?? fetch(SHELL_PATH);
}

self.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET') return;
	const url = new URL(request.url);

	if (FONT_HOSTS.has(url.hostname)) {
		event.respondWith(cacheFirst(request, FONTS));
		return;
	}
	if (url.origin !== self.location.origin) return;
	if (ONLINE_ONLY.some((prefix) => url.pathname.startsWith(prefix))) return;

	if (url.pathname.startsWith(IMMUTABLE) || STATIC.has(url.pathname)) {
		event.respondWith(cacheFirst(request, cacheFor(request.url)));
	} else if (request.mode === 'navigate') {
		// Every app page is the same client-rendered shell.
		event.respondWith(shell());
	} else if (url.pathname === MANIFEST) {
		event.respondWith(networkFirst(request));
	}
});
