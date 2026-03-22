import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	plugins: [svelte()],
	resolve: {
		alias: {
			$lib: path.resolve(__dirname, './src/lib'),
			$wasm: path.resolve(__dirname, './wasm/pkg')
		}
	},
	test: {
		include: ['src/**/*.test.ts'],
		exclude: ['src/**/legacy/**'],
		setupFiles: ['src/lib/wasm/setup.ts']
	}
});
