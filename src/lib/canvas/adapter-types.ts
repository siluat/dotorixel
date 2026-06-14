import type { Color } from './color';
import type { Document, PixelCanvas, ResizeAnchor } from './canvas-model';

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
 * The web shell's undo/redo stack — the **Document History** species.
 *
 * `push_document` / `undo_document` / `redo_document` carry a whole `Document`
 * snapshot (layer stack + active pointer + Marquee + counters); pushing clears
 * the redo future and evicts the oldest snapshot once the cap is exceeded.
 *
 * Structurally satisfied by WasmHistoryManager — no wrapping needed at runtime.
 */
export interface DocumentHistory {
	can_undo(): boolean;
	can_redo(): boolean;
	clear(): void;
	push_document(document: Document): void;
	undo_document(current: Document): Document | undefined;
	redo_document(current: Document): Document | undefined;
}
