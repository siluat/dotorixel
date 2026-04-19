import type { CanvasCoords } from './canvas-model';
import type { Color } from './color';
import { colorToHex } from './color';
import type { DrawingOps } from './drawing-ops';
import {
	CANVAS_CHANGED,
	NO_EFFECTS,
	type ContinuousTool,
	type DragTransformTool,
	type OneShotTool,
	type ShapePreviewTool,
	type ToolContext
} from './draw-tool';
import type { LoupeInputSource } from './loupe-position';
import { createPixelPerfectOps } from './pixel-perfect-ops';
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

function toolContext(
	spec: { drawColor: Color; drawButton: number },
	deps: StrokeDeps,
	ops: DrawingOps
): ToolContext {
	return {
		canvas: deps.host.pixelCanvas,
		ops,
		drawColor: spec.drawColor,
		drawButton: spec.drawButton,
		isShiftHeld: deps.isShiftHeld,
		foregroundColor: deps.host.foregroundColor,
		backgroundColor: deps.host.backgroundColor
	};
}

function openContinuousSession(
	spec: { tool: ContinuousTool; drawColor: Color; drawButton: number },
	deps: StrokeDeps
): StrokeSession {
	// Pixel-perfect wraps the base ops only when both the tool opts in and the
	// user has the feature enabled. The wrapper carries a per-stroke cache + tail,
	// so it must be scoped to this session.
	const strokeOps: DrawingOps =
		spec.tool.supportsPixelPerfect && deps.pixelPerfect()
			? createPixelPerfectOps(deps.baseOps)
			: deps.baseOps;
	const ctx = toolContext(spec, deps, strokeOps);

	return {
		start() {
			deps.history.pushSnapshot();
			return spec.tool.addsActiveColor
				? [{ type: 'addRecentColor', hex: colorToHex(spec.drawColor) }]
				: NO_EFFECTS;
		},
		draw(current, previous) {
			return spec.tool.apply(ctx, current, previous) ? CANVAS_CHANGED : NO_EFFECTS;
		},
		modifierChanged() {
			return NO_EFFECTS;
		},
		end() {
			return NO_EFFECTS;
		}
	};
}

function openDragTransformSession(
	spec: { tool: DragTransformTool; drawColor: Color; drawButton: number },
	deps: StrokeDeps
): StrokeSession {
	let snapshot: Uint8Array | null = null;
	let anchor: CanvasCoords | null = null;

	return {
		start() {
			deps.history.pushSnapshot();
			snapshot = new Uint8Array(deps.host.pixelCanvas.pixels());
			return NO_EFFECTS;
		},
		draw(current, previous) {
			if (previous === null) {
				anchor = current;
				return NO_EFFECTS;
			}
			if (!anchor || !snapshot) return NO_EFFECTS;
			spec.tool.applyTransform(toolContext(spec, deps, deps.baseOps), snapshot, anchor, current);
			return CANVAS_CHANGED;
		},
		modifierChanged() {
			return NO_EFFECTS;
		},
		end() {
			return NO_EFFECTS;
		}
	};
}

function openShapePreviewSession(
	spec: { tool: ShapePreviewTool; drawColor: Color; drawButton: number },
	deps: StrokeDeps
): StrokeSession {
	let snapshot: Uint8Array | null = null;
	let anchor: CanvasCoords | null = null;
	let lastCurrent: CanvasCoords | null = null;

	function redraw(): EditorEffects {
		if (!anchor || !snapshot || !lastCurrent) return NO_EFFECTS;
		deps.host.pixelCanvas.restore_pixels(snapshot);
		const end = deps.isShiftHeld() ? spec.tool.constrainFn(anchor, lastCurrent) : lastCurrent;
		spec.tool.onPreview(toolContext(spec, deps, deps.baseOps), anchor, end);
		return CANVAS_CHANGED;
	}

	return {
		start() {
			deps.history.pushSnapshot();
			snapshot = new Uint8Array(deps.host.pixelCanvas.pixels());
			return spec.tool.addsActiveColor
				? [{ type: 'addRecentColor', hex: colorToHex(spec.drawColor) }]
				: NO_EFFECTS;
		},
		draw(current, previous) {
			lastCurrent = current;
			if (previous === null) {
				anchor = current;
				spec.tool.onAnchor(toolContext(spec, deps, deps.baseOps), current);
				return CANVAS_CHANGED;
			}
			return redraw();
		},
		modifierChanged() {
			if (!lastCurrent) return NO_EFFECTS;
			return redraw();
		},
		end() {
			return NO_EFFECTS;
		}
	};
}

function openOneShotSession(
	spec: { tool: OneShotTool; drawColor: Color; drawButton: number },
	deps: StrokeDeps
): StrokeSession {
	let fired = false;

	return {
		start() {
			if (spec.tool.capturesHistory) deps.history.pushSnapshot();
			return spec.tool.addsActiveColor
				? [{ type: 'addRecentColor', hex: colorToHex(spec.drawColor) }]
				: NO_EFFECTS;
		},
		draw(current) {
			if (fired) return NO_EFFECTS;
			fired = true;
			return spec.tool.execute(toolContext(spec, deps, deps.baseOps), current);
		},
		modifierChanged() {
			return NO_EFFECTS;
		},
		end() {
			return NO_EFFECTS;
		}
	};
}

function openLiveSampleSession(
	spec: { drawButton: number; inputSource: LoupeInputSource },
	deps: StrokeDeps
): StrokeSession {
	let started = false;
	const commitTarget: 'foreground' | 'background' =
		spec.drawButton === 2 ? 'background' : 'foreground';

	return {
		start() {
			// Deferred to first draw — sampling needs the initial target pixel.
			return NO_EFFECTS;
		},
		draw(current) {
			if (!started) {
				deps.sampling.start({
					targetPixel: current,
					commitTarget,
					inputSource: spec.inputSource
				});
				started = true;
			} else {
				deps.sampling.update(current);
			}
			return NO_EFFECTS;
		},
		modifierChanged() {
			return NO_EFFECTS;
		},
		end() {
			return deps.sampling.commit();
		}
	};
}

/**
 * Construct the per-editor stroke-session factory. Call once per editor; the
 * returned object's opener methods are invoked on every stroke start. Each
 * opener is pure — it constructs a session without firing effects. Call the
 * returned session's `start()` to emit entry-time effects.
 */
export function createStrokeSessions(deps: StrokeDeps): StrokeSessions {
	return {
		continuous: (spec) => openContinuousSession(spec, deps),
		oneShot: (spec) => openOneShotSession(spec, deps),
		shapePreview: (spec) => openShapePreviewSession(spec, deps),
		dragTransform: (spec) => openDragTransformSession(spec, deps),
		liveSample: (spec) => openLiveSampleSession(spec, deps)
	};
}
