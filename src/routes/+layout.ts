import { initWasm } from '$lib/wasm/init';

export const ssr = false;

export async function load() {
	await initWasm();
}
