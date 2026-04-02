import { describe, it, expect } from 'vitest';
import { WasmHistoryManager } from '$wasm/dotorixel_wasm';

describe('WasmHistoryManager', () => {
	it('creates with custom max snapshots', () => {
		const history = new WasmHistoryManager(50);
		expect(history.can_undo()).toBe(false);
		expect(history.can_redo()).toBe(false);
	});

	it('creates a default manager', () => {
		const history = WasmHistoryManager.default_manager();
		expect(history.can_undo()).toBe(false);
	});

	it('exposes default max snapshots constant', () => {
		expect(WasmHistoryManager.default_max_snapshots()).toBe(100);
	});

	it('supports push and undo', () => {
		const history = new WasmHistoryManager(10);
		const state1 = new Uint8Array([1, 2, 3, 4]);
		const state2 = new Uint8Array([5, 6, 7, 8]);

		history.push_snapshot(1, 1, state1);
		expect(history.can_undo()).toBe(true);

		const snapshot = history.undo(1, 1, state2);
		expect(snapshot).toBeDefined();
		expect(Array.from(snapshot!.pixels())).toEqual([1, 2, 3, 4]);
		expect(snapshot!.width).toBe(1);
		expect(snapshot!.height).toBe(1);
	});

	it('supports undo and redo round-trip', () => {
		const history = new WasmHistoryManager(10);
		const state1 = new Uint8Array([10, 20, 30, 40]);
		const state2 = new Uint8Array([50, 60, 70, 80]);

		history.push_snapshot(1, 1, state1);

		// Undo: restore state1, passing current state2
		const undone = history.undo(1, 1, state2);
		expect(Array.from(undone!.pixels())).toEqual([10, 20, 30, 40]);
		expect(history.can_redo()).toBe(true);

		// Redo: restore state2, passing current (undone) state
		const redone = history.redo(1, 1, undone!.pixels());
		expect(Array.from(redone!.pixels())).toEqual([50, 60, 70, 80]);
	});

	it('returns undefined when nothing to undo/redo', () => {
		const history = new WasmHistoryManager(10);
		const current = new Uint8Array([1, 2, 3, 4]);
		expect(history.undo(1, 1, current)).toBeUndefined();
		expect(history.redo(1, 1, current)).toBeUndefined();
	});

	it('clears all history', () => {
		const history = new WasmHistoryManager(10);
		history.push_snapshot(1, 1, new Uint8Array([1, 2, 3, 4]));
		expect(history.can_undo()).toBe(true);

		history.clear();
		expect(history.can_undo()).toBe(false);
		expect(history.can_redo()).toBe(false);
	});

	it('preserves dimensions across undo', () => {
		const history = new WasmHistoryManager(10);
		// Push a 1×1 snapshot
		history.push_snapshot(1, 1, new Uint8Array([255, 0, 0, 255]));
		// Current state is 2×2 (after a resize)
		const snapshot = history.undo(2, 2, new Uint8Array(16));
		expect(snapshot!.width).toBe(1);
		expect(snapshot!.height).toBe(1);
	});

	it('preserves dimensions across redo', () => {
		const history = new WasmHistoryManager(10);
		history.push_snapshot(1, 1, new Uint8Array([255, 0, 0, 255]));
		// Undo from 2×2
		history.undo(2, 2, new Uint8Array(16));
		// Redo from 1×1
		const snapshot = history.redo(1, 1, new Uint8Array([255, 0, 0, 255]));
		expect(snapshot!.width).toBe(2);
		expect(snapshot!.height).toBe(2);
	});
});
