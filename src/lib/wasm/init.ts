let initialized = false;

export async function initWasm(): Promise<void> {
	if (initialized) return;
	const { default: init } = await import('$wasm/dotorixel_wasm');
	await init();
	initialized = true;
}
