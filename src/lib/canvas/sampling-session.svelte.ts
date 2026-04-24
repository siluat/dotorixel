import type { PixelCanvas, CanvasCoords } from './canvas-model';
import type { Color } from './color';
import { colorToHex } from './color';
import { NO_EFFECTS, type ToolEffects } from './draw-tool';
import type { LoupeInputSource } from './sampling/types';
import { sampleGrid } from './sampling/sample-grid';

/** Odd-sized grid around the target pixel. 9 matches the design spec. */
const GRID_SIZE = 9;
const CENTER_INDEX = (GRID_SIZE * GRID_SIZE - 1) / 2;

/** A cell is "commit-eligible" when it is in-canvas and fully/partially opaque. */
function isValidOpaque(cell: Color | null): cell is Color {
	return cell !== null && cell.a > 0;
}

export interface SamplingSessionStartParams {
	readonly targetPixel: CanvasCoords;
	readonly commitTarget: 'foreground' | 'background';
	/** Determines which loupe position offset (mouse vs touch) the overlay applies. */
	readonly inputSource: LoupeInputSource;
}

/**
 * A short-lived color-sampling session shared by the Eyedropper tool and
 * (in a later slice) the long-press touch gesture. Owns the state that
 * the `Loupe` overlay reads and the final commit that updates the active
 * foreground or background color.
 */
export interface SamplingSession {
	readonly isActive: boolean;
	readonly grid: readonly (Color | null)[];
	readonly centerColor: Color | null;
	/** The input source recorded at session start; `null` while no session is active. */
	readonly inputSource: LoupeInputSource | null;
	start(params: SamplingSessionStartParams): void;
	update(targetPixel: CanvasCoords): void;
	/**
	 * Finalizes the sampling session. Returns the effects that the caller
	 * should dispatch — typically a `colorPick` for the configured slot plus
	 * an `addRecentColor`. Returns `NO_EFFECTS` when there is nothing to
	 * commit (e.g., center pixel was transparent or out of canvas).
	 */
	commit(): ToolEffects;
	/** Deactivates the session without producing any effects. */
	cancel(): void;
}

export function createSamplingSession(getCanvas: () => PixelCanvas): SamplingSession {
	let isActive = $state(false);
	let grid = $state<(Color | null)[]>([]);
	let centerColor = $state<Color | null>(null);
	let inputSource = $state<LoupeInputSource | null>(null);
	let commitTarget: 'foreground' | 'background' = 'foreground';

	// Loupe visibility depends only on `isActive`. Both commit paths
	// (success and no-op) must call this or the previous grid stays visible
	// until the next start().
	function reset(): void {
		isActive = false;
		grid = [];
		centerColor = null;
		inputSource = null;
	}

	return {
		get isActive() {
			return isActive;
		},
		get grid() {
			return grid;
		},
		get centerColor() {
			return centerColor;
		},
		get inputSource() {
			return inputSource;
		},
		start(params: SamplingSessionStartParams): void {
			const canvas = getCanvas();
			grid = sampleGrid(canvas, params.targetPixel, GRID_SIZE);
			const raw = grid[CENTER_INDEX];
			centerColor = isValidOpaque(raw) ? raw : null;
			commitTarget = params.commitTarget;
			inputSource = params.inputSource;
			isActive = true;
		},
		update(target: CanvasCoords): void {
			const canvas = getCanvas();
			grid = sampleGrid(canvas, target, GRID_SIZE);
			const raw = grid[CENTER_INDEX];
			// centerColor is the last valid opaque color — preserved when the
			// new center is null (out of canvas) or transparent (a = 0) so a
			// future live preview does not flicker to "no color" during drag.
			if (isValidOpaque(raw)) {
				centerColor = raw;
			}
		},
		commit(): ToolEffects {
			// Guard against callers that reach `end()` on a lifecycle that
			// never saw a `draw` (e.g., Alt-eyedropper press/release with no
			// motion): the session was never started, so there is nothing
			// to commit and `grid[CENTER_INDEX]` would be `undefined`.
			if (!isActive) return NO_EFFECTS;
			// Commit uses the CURRENT center cell, not the preserved
			// `centerColor`. Releasing over null/transparent must produce no
			// effects even when an earlier opaque pixel is still in preview.
			const raw = grid[CENTER_INDEX];
			const pickedTarget = commitTarget;
			reset();
			if (!isValidOpaque(raw)) return NO_EFFECTS;
			return [
				{ type: 'colorPick', target: pickedTarget, color: raw },
				{ type: 'addRecentColor', hex: colorToHex(raw) }
			];
		},
		cancel(): void {
			reset();
		}
	};
}
