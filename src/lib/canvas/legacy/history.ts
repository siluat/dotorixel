import type { PixelData } from './canvas.ts';

export interface HistoryManager {
	readonly canUndo: boolean;
	readonly canRedo: boolean;
	pushSnapshot(pixels: PixelData): void;
	undo(currentPixels: PixelData): PixelData | null;
	redo(currentPixels: PixelData): PixelData | null;
	clear(): void;
}

const DEFAULT_MAX_SNAPSHOTS = 100;

export function createHistoryManager(maxSnapshots = DEFAULT_MAX_SNAPSHOTS): HistoryManager {
	const undoStack: PixelData[] = [];
	const redoStack: PixelData[] = [];

	return {
		get canUndo() {
			return undoStack.length > 0;
		},

		get canRedo() {
			return redoStack.length > 0;
		},

		pushSnapshot(pixels: PixelData): void {
			undoStack.push(pixels.slice());
			if (undoStack.length > maxSnapshots) {
				undoStack.shift();
			}
			redoStack.length = 0;
		},

		undo(currentPixels: PixelData): PixelData | null {
			const snapshot = undoStack.pop();
			if (!snapshot) return null;
			redoStack.push(currentPixels.slice());
			return snapshot;
		},

		redo(currentPixels: PixelData): PixelData | null {
			const snapshot = redoStack.pop();
			if (!snapshot) return null;
			undoStack.push(currentPixels.slice());
			return snapshot;
		},

		clear(): void {
			undoStack.length = 0;
			redoStack.length = 0;
		}
	};
}
