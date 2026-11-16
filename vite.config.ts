import { defineConfig } from 'vitest/config';
import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { execSync } from 'node:child_process';

/** The commit being built: QODDY_COMMIT (Docker builds have no .git), else git's, else ''. */
function commit(): string {
	if (process.env.QODDY_COMMIT !== undefined) return process.env.QODDY_COMMIT;
	try {
		const hash = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] });
		const dirty = execSync('git status --porcelain --untracked-files=no', {
			stdio: ['ignore', 'pipe', 'ignore']
		});
		return hash.toString().trim() + (dirty.length ? '-dirty' : '');
	} catch {
		return '';
	}
}

export default defineConfig({
	// Shown on Account → Stats for nerds, for both the app and the server it talks to.
	define: {
		__QODDY_BUILD__: JSON.stringify({ built: new Date().toISOString(), commit: commit() })
	},
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter(),
			// The service worker serves one cached shell for every app page, so its
			// asset URLs must not depend on the page's depth.
			paths: { relative: false }
		})
	],
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
