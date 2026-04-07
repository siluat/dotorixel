import type { Snapshot } from './pixel-canvas';

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
