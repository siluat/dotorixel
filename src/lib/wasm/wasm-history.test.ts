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

		history.push_snapshot(state1);
		expect(history.can_undo()).toBe(true);

		const restored = history.undo(state2);
		expect(restored).toBeInstanceOf(Uint8Array);
		expect(Array.from(restored!)).toEqual([1, 2, 3, 4]);
	});

	it('supports undo and redo round-trip', () => {
		const history = new WasmHistoryManager(10);
		const state1 = new Uint8Array([10, 20, 30, 40]);
		const state2 = new Uint8Array([50, 60, 70, 80]);

		history.push_snapshot(state1);

		// Undo: restore state1, passing current state2
		const undone = history.undo(state2);
		expect(Array.from(undone!)).toEqual([10, 20, 30, 40]);
		expect(history.can_redo()).toBe(true);

		// Redo: restore state2, passing current (undone) state
		const redone = history.redo(undone!);
		expect(Array.from(redone!)).toEqual([50, 60, 70, 80]);
	});

	it('returns undefined when nothing to undo/redo', () => {
		const history = new WasmHistoryManager(10);
		const current = new Uint8Array([1, 2, 3, 4]);
		expect(history.undo(current)).toBeUndefined();
		expect(history.redo(current)).toBeUndefined();
	});

	it('clears all history', () => {
		const history = new WasmHistoryManager(10);
		history.push_snapshot(new Uint8Array([1, 2, 3, 4]));
		expect(history.can_undo()).toBe(true);

		history.clear();
		expect(history.can_undo()).toBe(false);
		expect(history.can_redo()).toBe(false);
	});
});
