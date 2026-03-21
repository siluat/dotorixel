let initPromise: Promise<void> | null = null;

export async function initWasm(): Promise<void> {
	if (!initPromise) {
		initPromise = import('$wasm/dotorixel_wasm')
			.then(({ default: init }) => init())
			.then(() => {}); // init() returns Promise<InitOutput>; discard to match Promise<void>
	}
	return initPromise;
}
