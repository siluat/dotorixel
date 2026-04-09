import type { Color } from './color';
import type { PixelCanvas, ResizeAnchor } from './canvas-model';

/** Immutable pixel snapshot returned by undo/redo. */
export interface Snapshot {
	readonly width: number;
	readonly height: number;
	pixels(): Uint8Array;
}

/** Creates and transforms PixelCanvas instances. */
export interface CanvasFactory {
	create(width: number, height: number): PixelCanvas;
	fromPixels(width: number, height: number, pixels: Uint8Array): PixelCanvas;
	withColor(width: number, height: number, color: Color): PixelCanvas;
	resizeWithAnchor(
		canvas: PixelCanvas,
		newWidth: number,
		newHeight: number,
		anchor: ResizeAnchor
	): PixelCanvas;
}

/** Canvas dimension validation and presets. */
export interface CanvasConstraints {
	readonly minDimension: number;
	readonly maxDimension: number;
	isValidDimension(value: number): boolean;
	presets(): number[];
}

/**
 * Undo/redo stack that stores pixel snapshots.
 *
 * Structurally satisfied by WasmHistoryManager — no wrapping needed at runtime.
 */
export interface HistoryManager {
	can_undo(): boolean;
	can_redo(): boolean;
	clear(): void;
	push_snapshot(width: number, height: number, pixels: Uint8Array): void;
	undo(
		current_width: number,
		current_height: number,
		current_pixels: Uint8Array
	): Snapshot | undefined;
	redo(
		current_width: number,
		current_height: number,
		current_pixels: Uint8Array
	): Snapshot | undefined;
}
