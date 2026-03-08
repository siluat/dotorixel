import { describe, it, expect } from 'vitest';
import { createHistoryManager } from './history.ts';

function makePixels(...values: number[]): Uint8ClampedArray {
	return new Uint8ClampedArray(values);
}

describe('createHistoryManager', () => {
	describe('initial state', () => {
		it('canUndo is false', () => {
			const history = createHistoryManager();
			expect(history.canUndo).toBe(false);
		});

		it('canRedo is false', () => {
			const history = createHistoryManager();
			expect(history.canRedo).toBe(false);
		});
	});

	describe('pushSnapshot', () => {
		it('enables canUndo after push', () => {
			const history = createHistoryManager();
			history.pushSnapshot(makePixels(1, 2, 3, 4));
			expect(history.canUndo).toBe(true);
		});

		it('keeps canRedo false after push', () => {
			const history = createHistoryManager();
			history.pushSnapshot(makePixels(1, 2, 3, 4));
			expect(history.canRedo).toBe(false);
		});

		it('clears redo stack when new snapshot is pushed', () => {
			const history = createHistoryManager();
			history.pushSnapshot(makePixels(1, 0, 0, 0));
			history.undo(makePixels(2, 0, 0, 0));
			expect(history.canRedo).toBe(true);

			history.pushSnapshot(makePixels(3, 0, 0, 0));
			expect(history.canRedo).toBe(false);
		});

		it('stores an independent copy of pixel data', () => {
			const history = createHistoryManager();
			const pixels = makePixels(10, 20, 30, 40);
			history.pushSnapshot(pixels);

			pixels[0] = 255;

			const restored = history.undo(makePixels(0, 0, 0, 0));
			expect(restored![0]).toBe(10);
		});
	});

	describe('undo', () => {
		it('returns the most recent snapshot', () => {
			const history = createHistoryManager();
			history.pushSnapshot(makePixels(1, 2, 3, 4));
			const result = history.undo(makePixels(5, 6, 7, 8));
			expect(Array.from(result!)).toEqual([1, 2, 3, 4]);
		});

		it('enables canRedo after undo', () => {
			const history = createHistoryManager();
			history.pushSnapshot(makePixels(1, 2, 3, 4));
			history.undo(makePixels(5, 6, 7, 8));
			expect(history.canRedo).toBe(true);
		});

		it('saves current state to redo stack', () => {
			const history = createHistoryManager();
			history.pushSnapshot(makePixels(1, 0, 0, 0));
			history.undo(makePixels(2, 0, 0, 0));
			const redone = history.redo(makePixels(99, 0, 0, 0));
			expect(Array.from(redone!)).toEqual([2, 0, 0, 0]);
		});

		it('returns null when undo stack is empty', () => {
			const history = createHistoryManager();
			expect(history.undo(makePixels(1, 2, 3, 4))).toBeNull();
		});

		it('returns snapshots in LIFO order', () => {
			const history = createHistoryManager();
			history.pushSnapshot(makePixels(1, 0, 0, 0));
			history.pushSnapshot(makePixels(2, 0, 0, 0));
			history.pushSnapshot(makePixels(3, 0, 0, 0));

			expect(history.undo(makePixels(4, 0, 0, 0))![0]).toBe(3);
			expect(history.undo(makePixels(3, 0, 0, 0))![0]).toBe(2);
			expect(history.undo(makePixels(2, 0, 0, 0))![0]).toBe(1);
			expect(history.undo(makePixels(1, 0, 0, 0))).toBeNull();
		});

		it('stores an independent copy of current pixels in redo stack', () => {
			const history = createHistoryManager();
			history.pushSnapshot(makePixels(1, 0, 0, 0));

			const current = makePixels(2, 0, 0, 0);
			history.undo(current);

			current[0] = 255;

			const redone = history.redo(makePixels(99, 0, 0, 0));
			expect(redone![0]).toBe(2);
		});
	});

	describe('redo', () => {
		it('returns the most recently undone snapshot', () => {
			const history = createHistoryManager();
			history.pushSnapshot(makePixels(1, 0, 0, 0));
			history.undo(makePixels(2, 0, 0, 0));
			const result = history.redo(makePixels(1, 0, 0, 0));
			expect(Array.from(result!)).toEqual([2, 0, 0, 0]);
		});

		it('enables canUndo after redo', () => {
			const history = createHistoryManager();
			history.pushSnapshot(makePixels(1, 0, 0, 0));
			history.undo(makePixels(2, 0, 0, 0));
			expect(history.canUndo).toBe(false);

			history.redo(makePixels(1, 0, 0, 0));
			expect(history.canUndo).toBe(true);
		});

		it('returns null when redo stack is empty', () => {
			const history = createHistoryManager();
			expect(history.redo(makePixels(1, 2, 3, 4))).toBeNull();
		});

		it('saves current state to undo stack', () => {
			const history = createHistoryManager();
			history.pushSnapshot(makePixels(1, 0, 0, 0));
			history.undo(makePixels(2, 0, 0, 0));
			history.redo(makePixels(1, 0, 0, 0));

			const undone = history.undo(makePixels(99, 0, 0, 0));
			expect(Array.from(undone!)).toEqual([1, 0, 0, 0]);
		});

		it('stores an independent copy of current pixels in undo stack', () => {
			const history = createHistoryManager();
			history.pushSnapshot(makePixels(1, 0, 0, 0));
			history.undo(makePixels(2, 0, 0, 0));

			const current = makePixels(1, 0, 0, 0);
			history.redo(current);

			current[0] = 255;

			const undone = history.undo(makePixels(99, 0, 0, 0));
			expect(undone![0]).toBe(1);
		});
	});

	describe('maxSnapshots', () => {
		it('removes oldest snapshot when limit is exceeded', () => {
			const history = createHistoryManager(3);
			history.pushSnapshot(makePixels(1, 0, 0, 0));
			history.pushSnapshot(makePixels(2, 0, 0, 0));
			history.pushSnapshot(makePixels(3, 0, 0, 0));
			history.pushSnapshot(makePixels(4, 0, 0, 0));

			expect(history.undo(makePixels(5, 0, 0, 0))![0]).toBe(4);
			expect(history.undo(makePixels(4, 0, 0, 0))![0]).toBe(3);
			expect(history.undo(makePixels(3, 0, 0, 0))![0]).toBe(2);
			expect(history.undo(makePixels(2, 0, 0, 0))).toBeNull();
		});
	});

	describe('clear', () => {
		it('resets both stacks', () => {
			const history = createHistoryManager();
			history.pushSnapshot(makePixels(1, 0, 0, 0));
			history.pushSnapshot(makePixels(2, 0, 0, 0));
			history.undo(makePixels(3, 0, 0, 0));

			history.clear();

			expect(history.canUndo).toBe(false);
			expect(history.canRedo).toBe(false);
		});
	});
});
