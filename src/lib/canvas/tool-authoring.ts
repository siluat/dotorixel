import type { CanvasCoords, PixelCanvas } from './canvas-model';
import { colorToHex, type Color } from './color';
import type { DrawingOps } from './drawing-ops';
import {
	CANVAS_CHANGED,
	NO_EFFECTS,
	type ToolContext,
	type ToolEffects
} from './draw-tool';
import type { LoupeInputSource } from './sampling/types';
import { createPixelPerfectOps } from './pixel-perfect-ops';
import type { SamplingSession } from './sampling-session.svelte';
import type { ToolType } from './tool-registry';
import type { EditorEffects } from './tool-runner.svelte';

/**
 * Per-sample drawing step for continuous tools (pencil, eraser).
 * Returns true if the sample mutated the canvas.
 */
export type ApplyFn = (
	ctx: ToolContext,
	current: CanvasCoords,
	previous: CanvasCoords | null
) => boolean;

/**
 * Editor-scoped dependencies exposed to `customTool` authors.
 *
 * Captured as values at stroke begin (mid-stroke mutations ignored):
 * `foregroundColor`, `backgroundColor`, `pixelPerfect`.
 *
 * Live references that remain responsive during the stroke:
 * `pixelCanvas`, `baseOps`, `sampling`, `history` (write-only port),
 * `isShiftHeld` (evaluated per call — shape tools rely on this to
 * observe modifier changes via `modifierChanged`).
 */
export interface SessionHost {
	readonly pixelCanvas: PixelCanvas;
	readonly foregroundColor: Color;
	readonly backgroundColor: Color;
	/** Unwrapped ops — sugars decide PP-wrap via their own `pixelPerfect` flag. */
	readonly baseOps: DrawingOps;
	readonly history: { pushSnapshot(): void };
	readonly sampling: SamplingSession;
	readonly isShiftHeld: () => boolean;
	/** Pixel-perfect toggle snapshotted from shared state at stroke begin. */
	readonly pixelPerfect: boolean;
}

/**
 * Per-stroke identity. Every opener receives this. Tools ignore fields they
 * don't use (eyedropper ignores `drawColor`; most ignore `inputSource`).
 */
export interface StrokeSpec {
	readonly drawColor: Color;
	readonly drawButton: number;
	readonly inputSource: LoupeInputSource;
}

/**
 * Internal 4-method stroke contract. The engine bridges this to the
 * 3-method external `ActiveStroke` — `start()` fires eagerly at `begin()`
 * and its effects fold into the returned effects.
 */
export interface StrokeSession {
	start(): EditorEffects;
	draw(current: CanvasCoords, previous: CanvasCoords | null): EditorEffects;
	modifierChanged(): EditorEffects;
	end(): EditorEffects;
}

/**
 * Opaque contract between the engine and authored tools. Only `id` (for
 * diagnostics and registry coverage) and `open()` (for stroke construction)
 * are observable to consumers — all sugar-specific behavior is captured in
 * the closure returned from `open()`.
 */
export interface DrawTool {
	readonly id: ToolType;
	open(host: SessionHost, spec: StrokeSpec): StrokeSession;
}

function toolContext(host: SessionHost, spec: StrokeSpec, ops: DrawingOps): ToolContext {
	return {
		canvas: host.pixelCanvas,
		ops,
		drawColor: spec.drawColor,
		drawButton: spec.drawButton,
		isShiftHeld: host.isShiftHeld,
		foregroundColor: host.foregroundColor,
		backgroundColor: host.backgroundColor
	};
}

/**
 * Common case — paints pixels every sample along the drag path. Defaults:
 * supports pixel-perfect, adds the active draw color to recent colors at
 * stroke start, pushes a history snapshot at start.
 */
export function continuousTool(spec: {
	id: ToolType;
	apply: ApplyFn;
	addsActiveColor?: boolean;
	pixelPerfect?: boolean;
}): DrawTool {
	const addsActiveColor = spec.addsActiveColor ?? true;
	const supportsPixelPerfect = spec.pixelPerfect ?? true;
	return {
		id: spec.id,
		open(host, strokeSpec): StrokeSession {
			// PP wraps the base ops only when both the tool opts in and the user
			// has the feature enabled. The wrapper carries a per-stroke cache +
			// tail, so it must be scoped to this session.
			const strokeOps: DrawingOps =
				supportsPixelPerfect && host.pixelPerfect
					? createPixelPerfectOps(host.baseOps)
					: host.baseOps;
			const ctx = toolContext(host, strokeSpec, strokeOps);

			return {
				start() {
					host.history.pushSnapshot();
					return addsActiveColor
						? [{ type: 'addRecentColor', hex: colorToHex(strokeSpec.drawColor) }]
						: NO_EFFECTS;
				},
				draw(current, previous) {
					return spec.apply(ctx, current, previous) ? CANVAS_CHANGED : NO_EFFECTS;
				},
				modifierChanged() {
					return NO_EFFECTS;
				},
				end() {
					return NO_EFFECTS;
				}
			};
		}
	};
}

/**
 * Shape preview — snapshot-restore + shift-constrain provided automatically.
 * The first sample fires `stroke(ctx, start, start)`; WASM geometry helpers
 * treat degenerate input as a single-pixel stamp.
 */
export function shapeTool(spec: {
	id: ToolType;
	stroke: (ctx: ToolContext, start: CanvasCoords, end: CanvasCoords) => void;
	constrainOnShift: (start: CanvasCoords, end: CanvasCoords) => CanvasCoords;
	addsActiveColor?: boolean;
}): DrawTool {
	const addsActiveColor = spec.addsActiveColor ?? true;
	return {
		id: spec.id,
		open(host, strokeSpec): StrokeSession {
			const ctx = toolContext(host, strokeSpec, host.baseOps);
			let snapshot: Uint8Array | null = null;
			let anchor: CanvasCoords | null = null;
			let lastCurrent: CanvasCoords | null = null;

			function redraw(): EditorEffects {
				if (!anchor || !snapshot || !lastCurrent) return NO_EFFECTS;
				host.pixelCanvas.restore_pixels(snapshot);
				const end = host.isShiftHeld()
					? spec.constrainOnShift(anchor, lastCurrent)
					: lastCurrent;
				spec.stroke(ctx, anchor, end);
				return CANVAS_CHANGED;
			}

			return {
				start() {
					host.history.pushSnapshot();
					snapshot = new Uint8Array(host.pixelCanvas.pixels());
					return addsActiveColor
						? [{ type: 'addRecentColor', hex: colorToHex(strokeSpec.drawColor) }]
						: NO_EFFECTS;
				},
				draw(current, previous) {
					lastCurrent = current;
					if (previous === null) {
						anchor = current;
						spec.stroke(ctx, current, current);
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
	};
}

/**
 * Click-once — fires on first sample, ignores subsequent drag. Defaults:
 * captures history before firing, adds active color to recent colors.
 */
export function oneShotTool(spec: {
	id: ToolType;
	execute: (ctx: ToolContext, target: CanvasCoords) => ToolEffects;
	addsActiveColor?: boolean;
	capturesHistory?: boolean;
}): DrawTool {
	const addsActiveColor = spec.addsActiveColor ?? true;
	const capturesHistory = spec.capturesHistory ?? true;
	return {
		id: spec.id,
		open(host, strokeSpec): StrokeSession {
			const ctx = toolContext(host, strokeSpec, host.baseOps);
			let fired = false;

			return {
				start() {
					if (capturesHistory) host.history.pushSnapshot();
					return addsActiveColor
						? [{ type: 'addRecentColor', hex: colorToHex(strokeSpec.drawColor) }]
						: NO_EFFECTS;
				},
				draw(current) {
					if (fired) return NO_EFFECTS;
					fired = true;
					return spec.execute(ctx, current);
				},
				modifierChanged() {
					return NO_EFFECTS;
				},
				end() {
					return NO_EFFECTS;
				}
			};
		}
	};
}

/**
 * Escape hatch — full session control for oddballs whose lifecycles don't
 * fit any sugar (eyedropper, move). The author writes `open()` directly and
 * returns a `StrokeSession`.
 */
export function customTool(spec: {
	id: ToolType;
	open(host: SessionHost, strokeSpec: StrokeSpec): StrokeSession;
}): DrawTool {
	return {
		id: spec.id,
		open: spec.open
	};
}
