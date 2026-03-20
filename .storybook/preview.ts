import type { Preview } from '@storybook/sveltekit';
import '../src/styles/global.css';
import { initWasm } from '../src/lib/wasm/init';

const preview: Preview = {
	async beforeAll() {
		await initWasm();
	}
};

export default preview;
