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
 * Every entry carries a whole `Document` snapshot (layer stack + active
 * pointer + Marquee + counters), and `begin_edit` / `end_edit` are the only
 * way to record one: `begin_edit` holds the pre-edit document as the Edit
 * Baseline, and `end_edit` commits it only when the edit actually changed the
 * document — a no-op edit leaves both stacks (including the redo future)
 * untouched. The core owns the comparison. Committing clears the redo future
 * and evicts the oldest snapshot once the cap is exceeded.
 *
 * `undo_document` / `redo_document` swap the caller's current document across
 * the two stacks, returning the restored snapshot.
 *
 * Structurally satisfied by WasmHistoryManager — no wrapping needed at runtime.
 */
export interface DocumentHistory {
	can_undo(): boolean;
	can_redo(): boolean;
	clear(): void;
	begin_edit(document: Document): void;
	/** Returns whether an undo entry was committed. */
	end_edit(current: Document): boolean;
	undo_document(current: Document): Document | undefined;
	redo_document(current: Document): Document | undefined;
}
