import type { PixelCanvas, CanvasCoords } from './canvas-model';
import type { Color } from './color';
import { colorToHex } from './color';
import { NO_EFFECTS, type ToolEffects } from './draw-tool';
import { sampleGrid } from './sample-grid';

/** Odd-sized grid around the target pixel. 9 matches the design spec. */
const GRID_SIZE = 9;
const CENTER_INDEX = (GRID_SIZE * GRID_SIZE - 1) / 2;

export interface SamplingSessionStartParams {
	readonly targetPixel: CanvasCoords;
	readonly commitTarget: 'foreground' | 'background';
}

/**
 * A short-lived color-sampling session shared by the Eyedropper tool and
 * (in a later slice) the long-press touch gesture. Owns the state that
 * the `Loupe` overlay reads and the final commit that updates the active
 * foreground or background color.
 */
export interface SamplingSession {
	readonly isActive: boolean;
	readonly grid: readonly Color[];
	readonly centerColor: Color | null;
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
	let grid = $state<Color[]>([]);
	let centerColor = $state<Color | null>(null);
	let targetPixel: CanvasCoords | null = null;
	let commitTarget: 'foreground' | 'background' = 'foreground';

	// Loupe 가시성은 `isActive`에만 의존한다. commit() 성공/무효 양 경로에서
	// 모두 호출되지 않으면 다음 start() 전까지 이전 grid가 계속 노출된다.
	function reset(): void {
		isActive = false;
		grid = [];
		centerColor = null;
		targetPixel = null;
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
		start(params: SamplingSessionStartParams): void {
			const canvas = getCanvas();
			grid = sampleGrid(canvas, params.targetPixel, GRID_SIZE);
			centerColor = grid[CENTER_INDEX];
			targetPixel = params.targetPixel;
			commitTarget = params.commitTarget;
			isActive = true;
		},
		update(target: CanvasCoords): void {
			const canvas = getCanvas();
			grid = sampleGrid(canvas, target, GRID_SIZE);
			centerColor = grid[CENTER_INDEX];
			targetPixel = target;
		},
		commit(): ToolEffects {
			const pickedColor = centerColor;
			const pickedTarget = commitTarget;
			const pickedPixel = targetPixel;
			const canvas = getCanvas();
			reset();
			if (!pickedPixel || !pickedColor || pickedColor.a === 0) return NO_EFFECTS;
			// WASM 바인딩이 u32로 캐스팅되기 전, TS 경계에서 음수를 명시적으로 거른다.
			if (pickedPixel.x < 0 || pickedPixel.y < 0) return NO_EFFECTS;
			if (!canvas.is_inside_bounds(pickedPixel.x, pickedPixel.y)) return NO_EFFECTS;
			return [
				{ type: 'colorPick', target: pickedTarget, color: pickedColor },
				{ type: 'addRecentColor', hex: colorToHex(pickedColor) }
			];
		},
		cancel(): void {
			reset();
		}
	};
}
