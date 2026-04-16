import { sveltekit } from '@sveltejs/kit/vite';
import { paraglideVitePlugin } from '@inlang/paraglide-js';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit(),
		paraglideVitePlugin({
			project: './project.inlang',
			outdir: './src/lib/paraglide',
			// SPA-recommended strategy: explicit user choice (localStorage) wins first,
			// shared/bookmarked URLs win next, then browser preference, then baseLocale.
			strategy: ['localStorage', 'url', 'preferredLanguage', 'baseLocale'],
			// Override on `/` only: drop the `url` strategy so the root path falls through
			// to `preferredLanguage`. Without this override, the wildcard `en` URL pattern
			// (`/:path(.*)?`) swallows `/` and `preferredLanguage` never runs. See
			// issues/052-i18n-root-locale-detection.md.
			routeStrategies: [
				{
					match: '/',
					strategy: ['localStorage', 'preferredLanguage', 'baseLocale']
				}
			]
		})
	],
	server: {
		port: 5173,
		strictPort: true,
		fs: {
			allow: ['wasm/pkg']
		}
	}
});
