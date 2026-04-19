import type { CanvasCoords } from './canvas-model';
import type { Color } from './color';
import type { DrawingOps } from './drawing-ops';
import type {
	ContinuousTool,
	DragTransformTool,
	OneShotTool,
	ShapePreviewTool
} from './draw-tool';
import type { LoupeInputSource } from './loupe-position';
import type { SamplingSession } from './sampling-session.svelte';
import type { EditorEffects, ToolRunnerHost } from './tool-runner.svelte';

/**
 * Uniform per-stroke interface returned by every opener on a `StrokeSessions`.
 *
 * - `start()` fires any entry-time effects (e.g. `addRecentColor`) and is
 *   called once, immediately after opening.
 * - `draw(current, previous)` drives one pointer sample; `previous` is `null`
 *   on the first sample of the stroke.
 * - `modifierChanged()` lets shape tools re-render with the current shift
 *   state; kinds that don't observe modifiers return no effects.
 * - `end()` tears the stroke down and returns any deferred effects (e.g. a
 *   live-sample commit).
 */
export interface StrokeSession {
	start(): EditorEffects;
	draw(current: CanvasCoords, previous: CanvasCoords | null): EditorEffects;
	modifierChanged(): EditorEffects;
	end(): EditorEffects;
}

/**
 * Editor-scoped dependencies captured once at factory construction. Per-call
 * stroke identity (tool, color, button) is passed separately on each opener
 * invocation via `spec`.
 */
export interface StrokeDeps {
	readonly host: ToolRunnerHost;
	readonly baseOps: DrawingOps;
	readonly history: { pushSnapshot(): void };
	readonly sampling: SamplingSession;
	readonly isShiftHeld: () => boolean;
	readonly pixelPerfect: () => boolean;
}

/** Five typed opener methods — one per `DrawTool.kind`. */
export interface StrokeSessions {
	continuous(spec: {
		tool: ContinuousTool;
		drawColor: Color;
		drawButton: number;
	}): StrokeSession;
	oneShot(spec: {
		tool: OneShotTool;
		drawColor: Color;
		drawButton: number;
	}): StrokeSession;
	shapePreview(spec: {
		tool: ShapePreviewTool;
		drawColor: Color;
		drawButton: number;
	}): StrokeSession;
	dragTransform(spec: {
		tool: DragTransformTool;
		drawColor: Color;
		drawButton: number;
	}): StrokeSession;
	liveSample(spec: {
		drawButton: number;
		inputSource: LoupeInputSource;
	}): StrokeSession;
}

/**
 * Construct the per-editor stroke-session factory. Call once per editor; the
 * returned object's opener methods are invoked on every stroke start. Each
 * opener is pure — it constructs a session without firing effects. Call the
 * returned session's `start()` to emit entry-time effects.
 */
export function createStrokeSessions(deps: StrokeDeps): StrokeSessions {
	void deps;
	const notImplemented = (): StrokeSession => {
		throw new Error('stroke-session: opener not yet implemented');
	};
	return {
		continuous: notImplemented,
		oneShot: notImplemented,
		shapePreview: notImplemented,
		dragTransform: notImplemented,
		liveSample: notImplemented
	};
}
