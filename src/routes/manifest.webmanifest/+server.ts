// The web app manifest, built from the site settings so the installed app
// carries the site's name and default theme color.

import { db } from '#lib/server/db.ts';
import { getSettings } from '#lib/server/settings.ts';
import { findTheme, THEMES } from '#lib/themes.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => {
	const settings = getSettings(db());
	const theme = findTheme(settings.default_theme) ?? THEMES[0];
	const manifest = {
		name: settings.site_name,
		short_name: settings.site_name,
		description: 'A thought for each day, and a place to keep your own.',
		start_url: '/',
		scope: '/',
		display: 'standalone',
		background_color: theme.light,
		theme_color: theme.light,
		icons: [
			{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
			{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
			{ src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
			{ src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
		]
	};
	return new Response(JSON.stringify(manifest), {
		headers: {
			'content-type': 'application/manifest+json',
			'cache-control': 'no-cache'
		}
	});
};
