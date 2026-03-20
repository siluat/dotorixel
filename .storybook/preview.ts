import type { Preview } from '@storybook/sveltekit';
import '../src/styles/global.css';
import '../src/lib/ui-pixel/pixel-tokens.css';
import '../src/lib/ui-pebble/pebble-tokens.css';
import { initWasm } from '../src/lib/wasm/init';

const preview: Preview = {
	async beforeAll() {
		await initWasm();
	}
};

export default preview;
