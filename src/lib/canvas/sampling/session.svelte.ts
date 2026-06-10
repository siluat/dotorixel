import type { CanvasCoords, CanvasPoint } from '../canvas-model';
import { colorToHex, type Color } from '../color';
import { NO_EFFECTS, type ToolEffects } from '../draw-tool';
import { computeLoupePosition } from './loupe-position';
import {
	GRID_SIZE,
	LOUPE_CENTER_INDEX,
	LOUPE_HEIGHT,
	LOUPE_WIDTH,
	MOUSE_OFFSET,
	TOUCH_OFFSET
} from './loupe-config';
import type { SamplingPort } from './ports';
import { sampleGrid } from './sample-grid';
import type {
	LoupeInputSource,
	SamplingSessionUpdatePointerParams,
	SamplingSessionView
} from './types';

function isValidOpaque(cell: Color | null): cell is Color {
	return cell !== null && cell.a > 0;
}

interface CanvasSamplingSessionStartParams {
	readonly targetPixel: CanvasPoint;
	readonly commitTarget: 'foreground' | 'background';
	readonly inputSource: LoupeInputSource;
}

/**
 * Canvas sampling session shared by the Eyedropper tool and the long-press
 * touch gesture. Owns the sampled grid, the commit target, and the loupe
 * overlay's window-coord position. Disruption (`cancel`) discards without
 * effect; clean release (`commit`) returns the effects to dispatch.
 */
export interface CanvasSamplingSession extends SamplingSessionView {
	readonly isActive: boolean;
	start(params: CanvasSamplingSessionStartParams): void;
	update(targetPixel: CanvasPoint): void;
	commit(): ToolEffects;
	cancel(): void;
}

export function createCanvasSamplingSession(opts: {
	getSamplingPort: () => SamplingPort;
	mapTarget?: (target: CanvasPoint) => CanvasCoords;
}): CanvasSamplingSession {
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

	function sampleTarget(target: CanvasPoint): (Color | null)[] {
		const port = opts.getSamplingPort();
		const center = opts.mapTarget?.(target) ?? target;
		return sampleGrid(port, center, GRID_SIZE);
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
		start(params: CanvasSamplingSessionStartParams): void {
			grid = sampleTarget(params.targetPixel);
			commitTarget = params.commitTarget;
			inputSource = params.inputSource;
			isActive = true;
		},
		update(target: CanvasPoint): void {
			grid = sampleTarget(target);
		},
		updatePointer(params: SamplingSessionUpdatePointerParams): void {
			screen = { x: params.screen.x, y: params.screen.y };
			viewport = { width: params.viewport.width, height: params.viewport.height };
		},
		commit(): ToolEffects {
			if (!isActive) return NO_EFFECTS;
			const raw = grid[LOUPE_CENTER_INDEX];
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
