import type { CanvasCoords } from '../canvas-model';
import { colorToHex, type Color } from '../color';
import { NO_EFFECTS, type ToolEffects } from '../draw-tool';
import { computeLoupePosition } from './loupe-position';
import {
	GRID_SIZE,
	LOUPE_HEIGHT,
	LOUPE_WIDTH,
	MOUSE_OFFSET,
	TOUCH_OFFSET
} from './loupe-config';
import type { CanvasSamplingPort } from './ports';
import { sampleGrid } from './sample-grid';
import type { LoupeInputSource } from './types';

const CENTER_INDEX = (GRID_SIZE * GRID_SIZE - 1) / 2;

function isValidOpaque(cell: Color | null): cell is Color {
	return cell !== null && cell.a > 0;
}

export interface SamplingSessionStartParams {
	readonly targetPixel: CanvasCoords;
	readonly commitTarget: 'foreground' | 'background';
	readonly inputSource: LoupeInputSource;
}

export interface SamplingSessionUpdatePointerParams {
	readonly screen: { readonly x: number; readonly y: number };
	readonly viewport: { readonly width: number; readonly height: number };
}

/**
 * Color-sampling session shared by the Eyedropper tool and the long-press
 * touch gesture. Owns the sampled grid, the commit target, and the loupe
 * overlay's window-coord position. Disruption (`cancel`) discards without
 * effect; clean release (`commit`) returns the effects to dispatch.
 */
export interface SamplingSession {
	readonly isActive: boolean;
	readonly grid: readonly (Color | null)[];
	/** Window-coord top-left of the loupe overlay; null when inactive or before any pointer push. */
	readonly position: { readonly x: number; readonly y: number } | null;
	start(params: SamplingSessionStartParams): void;
	update(targetPixel: CanvasCoords): void;
	/** Always safe to call — pointer state caches even when the session is inactive. */
	updatePointer(params: SamplingSessionUpdatePointerParams): void;
	commit(): ToolEffects;
	cancel(): void;
}

export function createSamplingSession(opts: {
	getSamplingPort: () => CanvasSamplingPort;
}): SamplingSession {
	let isActive = $state(false);
	let grid = $state<(Color | null)[]>([]);
	let inputSource = $state<LoupeInputSource | null>(null);
	let screen = $state<{ x: number; y: number } | null>(null);
	let viewport = $state<{ width: number; height: number } | null>(null);
	let commitTarget: 'foreground' | 'background' = 'foreground';

	const position = $derived.by<{ x: number; y: number } | null>(() => {
		if (!isActive) return null;
		if (!screen || !viewport || !inputSource) return null;
		const r = computeLoupePosition({
			pointer: screen,
			viewport,
			loupe: { width: LOUPE_WIDTH, height: LOUPE_HEIGHT },
			mouseOffset: MOUSE_OFFSET,
			touchOffset: TOUCH_OFFSET,
			inputSource
		});
		return { x: r.x, y: r.y };
	});

	function reset(): void {
		// `commitTarget` is intentionally not reset here — `start()` always
		// rewrites it, and `commit()` is guarded by `isActive` so a stale value
		// can never leak into an effect.
		isActive = false;
		grid = [];
		inputSource = null;
	}

	return {
		get isActive() {
			return isActive;
		},
		get grid() {
			return grid;
		},
		get position() {
			return position;
		},
		start(params: SamplingSessionStartParams): void {
			const port = opts.getSamplingPort();
			grid = sampleGrid(port, params.targetPixel, GRID_SIZE);
			commitTarget = params.commitTarget;
			inputSource = params.inputSource;
			isActive = true;
		},
		update(target: CanvasCoords): void {
			const port = opts.getSamplingPort();
			grid = sampleGrid(port, target, GRID_SIZE);
		},
		updatePointer(params: SamplingSessionUpdatePointerParams): void {
			screen = { x: params.screen.x, y: params.screen.y };
			viewport = { width: params.viewport.width, height: params.viewport.height };
		},
		commit(): ToolEffects {
			if (!isActive) return NO_EFFECTS;
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

