import { describe, it, expectTypeOf } from 'vitest';
import type {
	WasmPixelCanvas,
	WasmViewport,
	WasmHistoryManager,
	WasmSnapshot
} from '$wasm/dotorixel_wasm';
import type { PixelCanvas, Snapshot } from './pixel-canvas';
import type { Viewport } from './viewport';
import type { HistoryManager } from './history';

/**
 * Compile-time structural compatibility checks.
 *
 * These verify that WASM classes satisfy the facade interfaces.
 * If WASM bindings change incompatibly, this file fails to compile.
 * No runtime assertions needed — the type system does the work.
 */
describe('WASM structural compatibility', () => {
	it('WasmPixelCanvas satisfies PixelCanvas', () => {
		expectTypeOf<WasmPixelCanvas>().toMatchTypeOf<PixelCanvas>();
	});

	it('WasmViewport satisfies Viewport', () => {
		expectTypeOf<WasmViewport>().toMatchTypeOf<Viewport>();
	});

	it('WasmHistoryManager satisfies HistoryManager', () => {
		expectTypeOf<WasmHistoryManager>().toMatchTypeOf<HistoryManager>();
	});

	it('WasmSnapshot satisfies Snapshot', () => {
		expectTypeOf<WasmSnapshot>().toMatchTypeOf<Snapshot>();
	});
});
