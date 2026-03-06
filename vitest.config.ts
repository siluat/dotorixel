import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	resolve: {
		alias: {
			$lib: path.resolve(__dirname, './src/lib'),
			$wasm: path.resolve(__dirname, './wasm/pkg')
		}
	},
	test: {
		include: ['src/**/*.test.ts']
	}
});
