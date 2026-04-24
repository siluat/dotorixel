import type { CanvasCoords } from './canvas-model';
import type { Color } from './color';
import type { PointerType } from './canvas-interaction.svelte';
import type { LoupeInputSource } from './sampling/types';
import type { SamplingSession } from './sampling-session.svelte';
import type { SharedState } from './shared-state.svelte';
import type { SessionHost, StrokeSpec } from './tool-authoring';
import type { EditorEffects, ToolRunnerHost } from './tool-runner.svelte';
import { createDrawingOps } from './wasm-backend';
import { createAllTools } from './tool-registry';

/**
 * Thin per-stroke handle returned from `StrokeEngine.begin()`. Three methods:
 *
 * - `sample(current, previous)` — one pointer sample; `previous` is `null`
 *   on the first sample of the stroke.
 * - `refresh()` — re-run preview/render after a modifier change (shift).
 * - `end()` — tear down; return any deferred effects (e.g. color-pick commit).
 *
 * The sugar's internal 4-method `StrokeSession` adds a `start()` that the
 * engine fires eagerly at `begin()` and folds into the returned effects, so
 * callers never see an "opened but not started" phase.
 */
export interface ActiveStroke {
	sample(current: CanvasCoords, previous: CanvasCoords | null): EditorEffects;
	refresh(): EditorEffects;
	end(): EditorEffects;
}

/**
 * Editor-scoped dependencies captured once at engine construction. Per-stroke
 * values (active tool, pixel-perfect toggle, draw color, input source) are
 * resolved on each `begin()` call — mid-stroke mutations to `shared.activeTool`
 * or `shared.pixelPerfect` do not affect an already-begun stroke.
 */
export interface StrokeEngineDeps {
	readonly host: ToolRunnerHost;
	readonly shared: SharedState;
	readonly history: { pushSnapshot(): void };
	readonly sampling: SamplingSession;
	readonly isShiftHeld: () => boolean;
}

export interface StrokeEngine {
	begin(opts: { button: number; pointerType: PointerType }): {
		stroke: ActiveStroke;
		effects: EditorEffects;
	};
}

/**
 * Single entry point the tool runner uses to drive a stroke. On each `begin()`:
 *
 *   1. Resolves the active tool from `shared.activeTool`.
 *   2. Snapshots `shared.pixelPerfect` — the sugar decides internally whether
 *      to wrap ops, so the engine just hands the flag down.
 *   3. Derives `drawColor` (left = foreground, right = background) and
 *      `inputSource` (touch = touch; mouse and pen share the mouse offset).
 *   4. Calls `tool.open(host, spec)` to obtain a `StrokeSession`, then fires
 *      `session.start()`; the start effects fold into the returned effects.
 *
 * The returned `ActiveStroke` closes over the resolved tool + session; every
 * subsequent sample flows through that fixed closure.
 */
export function createStrokeEngine(deps: StrokeEngineDeps): StrokeEngine {
	const baseOps = createDrawingOps(() => deps.host.pixelCanvas);
	const tools = createAllTools();

	return {
		begin({ button, pointerType }) {
			const tool = tools[deps.shared.activeTool];
			const drawColor: Color =
				button === 2 ? deps.host.backgroundColor : deps.host.foregroundColor;
			const inputSource: LoupeInputSource = pointerType === 'touch' ? 'touch' : 'mouse';
			const spec: StrokeSpec = { drawColor, drawButton: button, inputSource };

			const host: SessionHost = {
				pixelCanvas: deps.host.pixelCanvas,
				foregroundColor: deps.host.foregroundColor,
				backgroundColor: deps.host.backgroundColor,
				baseOps,
				history: deps.history,
				sampling: deps.sampling,
				isShiftHeld: deps.isShiftHeld,
				pixelPerfect: deps.shared.pixelPerfect
			};

			const session = tool.open(host, spec);
			const effects = session.start();

			const stroke: ActiveStroke = {
				sample: (current, previous) => session.draw(current, previous),
				refresh: () => session.modifierChanged(),
				end: () => session.end()
			};

			return { stroke, effects };
		}
	};
}
