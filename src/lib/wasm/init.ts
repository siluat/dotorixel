let initPromise: Promise<void> | null = null;

export async function initWasm(): Promise<void> {
	if (!initPromise) {
		initPromise = import('$wasm/dotorixel_wasm').then(({ default: init }) => init());
	}
	return initPromise;
}
