import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { paraglideVitePlugin } from '@inlang/paraglide-js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	plugins: [
		svelte(),
		paraglideVitePlugin({
			project: './project.inlang',
			outdir: './src/lib/paraglide',
			// Must mirror vite.config.ts — see issues/052-i18n-root-locale-detection.md.
			strategy: ['localStorage', 'url', 'preferredLanguage', 'baseLocale'],
			routeStrategies: [
				{
					match: '/',
					strategy: ['localStorage', 'preferredLanguage', 'baseLocale']
				}
			]
		})
	],
	resolve: {
		conditions: ['browser'],
		alias: {
			$lib: path.resolve(__dirname, './src/lib'),
			$wasm: path.resolve(__dirname, './wasm/pkg')
		}
	},
	test: {
		include: ['src/**/*.test.ts'],
		setupFiles: ['src/lib/wasm/setup.ts']
	}
});
