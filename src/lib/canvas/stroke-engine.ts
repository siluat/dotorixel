import type { CanvasPoint } from './canvas-model';
import type { Color } from './color';
import type { PointerType } from './canvas-interaction.svelte';
import type { LoupeInputSource } from './sampling/types';
import type { CanvasSamplingSession } from './sampling/session.svelte';
import type { SharedState } from './shared-state.svelte';
import type { SessionHost, StrokeSpec } from './tool-authoring';
import type { EditorEffects, ToolRunnerHost } from './tool-runner.svelte';
import { createDrawingOps } from './wasm-backend';
import { createAllTools } from './tool-registry';

/**
 * Thin per-stroke handle returned from `StrokeEngine.begin()`. Four methods:
 *
 * - `sample(current, previous)` — one pointer sample; `previous` is `null`
 *   on the first sample of the stroke.
 * - `refresh()` — re-run preview/render after a modifier change (shift).
 * - `end()` — tear down; return any deferred effects (e.g. color-pick commit).
 * - `cancel()` — tear down after an interrupted pointer sequence without
 *   committing deferred effects.
 *
 * The sugar's internal `StrokeSession` adds a `start()` that the
 * engine fires eagerly at `begin()` and folds into the returned effects, so
 * callers never see an "opened but not started" phase.
 */
export interface ActiveStroke {
	sample(current: CanvasPoint, previous: CanvasPoint | null): EditorEffects;
	refresh(): EditorEffects;
	end(): EditorEffects;
	cancel(): EditorEffects;
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
	readonly sampling: CanvasSamplingSession;
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
	const baseOps = createDrawingOps(() => deps.host.document);
	const tools = createAllTools();

	return {
		begin({ button, pointerType }) {
			const activeTool = deps.shared.activeTool;
			const tool = tools[activeTool];
			const drawColor: Color =
				button === 2 ? deps.host.backgroundColor : deps.host.foregroundColor;
			const inputSource: LoupeInputSource = pointerType === 'touch' ? 'touch' : 'mouse';
			const spec: StrokeSpec = { drawColor, drawButton: button, inputSource };

			const host: SessionHost = {
				document: deps.host.document,
				foregroundColor: deps.host.foregroundColor,
				backgroundColor: deps.host.backgroundColor,
				baseOps,
				sampling: deps.sampling,
				isShiftHeld: deps.isShiftHeld,
				pixelPerfect: deps.shared.pixelPerfect
			};

			const session = tool.open(host, spec);
			const effects = session.start();

			const stroke: ActiveStroke = {
				sample: (current, previous) => session.draw(current, previous),
				refresh: () => session.modifierChanged(),
				end: () => session.end(),
				cancel: () => session.cancel()
			};

			return { stroke, effects };
		}
	};
}
