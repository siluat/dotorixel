import type { CanvasCoords, PixelCanvas } from './canvas-model';
import type { Color } from './color';
import type { DrawingOps } from './drawing-ops';
import type {
	ContinuousTool,
	DragTransformTool,
	LiveSampleTool,
	OneShotTool,
	ShapePreviewTool,
	ToolContext,
	ToolEffects
} from './draw-tool';
import type { LoupeInputSource } from './loupe-position';
import type { SamplingSession } from './sampling-session.svelte';
import {
	openContinuousSession,
	openOneShotSession,
	openShapePreviewSession,
	type StrokeDeps,
	type StrokeSession
} from './stroke-session';
import type { ToolType } from './tool-registry';

export type { StrokeSession } from './stroke-session';

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
 * Editor-scoped dependencies exposed to `customTool` authors. Fields are
 * resolved at stroke begin — mid-stroke mutations to shared state do not
 * affect the active session.
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
 * Output shape common to every sugar — carries the opaque `open()` that the
 * engine calls on stroke begin. Sugar-specific legacy fields (`kind`,
 * `apply`, `constrainFn`, etc.) are attached alongside `id` + `open` until
 * commit 11 makes `DrawTool` opaque.
 */
export interface AuthoredTool {
	readonly id: ToolType;
	open(host: SessionHost, spec: StrokeSpec): StrokeSession;
}

function depsFromHost(host: SessionHost): StrokeDeps {
	return {
		host: {
			pixelCanvas: host.pixelCanvas,
			foregroundColor: host.foregroundColor,
			backgroundColor: host.backgroundColor
		},
		baseOps: host.baseOps,
		history: host.history,
		sampling: host.sampling,
		isShiftHeld: host.isShiftHeld,
		pixelPerfect: () => host.pixelPerfect
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
}): ContinuousTool & AuthoredTool {
	const legacy: ContinuousTool = {
		kind: 'continuous',
		addsActiveColor: spec.addsActiveColor ?? true,
		supportsPixelPerfect: spec.pixelPerfect ?? true,
		apply: spec.apply
	};
	return {
		...legacy,
		id: spec.id,
		open(host, strokeSpec): StrokeSession {
			return openContinuousSession(
				{
					tool: legacy,
					drawColor: strokeSpec.drawColor,
					drawButton: strokeSpec.drawButton
				},
				depsFromHost(host)
			);
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
}): ShapePreviewTool & AuthoredTool {
	const legacy: ShapePreviewTool = {
		kind: 'shapePreview',
		addsActiveColor: spec.addsActiveColor ?? true,
		constrainFn: spec.constrainOnShift,
		onAnchor: (ctx, start) => spec.stroke(ctx, start, start),
		onPreview: spec.stroke
	};
	return {
		...legacy,
		id: spec.id,
		open(host, strokeSpec): StrokeSession {
			return openShapePreviewSession(
				{
					tool: legacy,
					drawColor: strokeSpec.drawColor,
					drawButton: strokeSpec.drawButton
				},
				depsFromHost(host)
			);
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
}): OneShotTool & AuthoredTool {
	const legacy: OneShotTool = {
		kind: 'oneShot',
		addsActiveColor: spec.addsActiveColor ?? true,
		capturesHistory: spec.capturesHistory ?? true,
		execute: spec.execute
	};
	return {
		...legacy,
		id: spec.id,
		open(host, strokeSpec): StrokeSession {
			return openOneShotSession(
				{
					tool: legacy,
					drawColor: strokeSpec.drawColor,
					drawButton: strokeSpec.drawButton
				},
				depsFromHost(host)
			);
		}
	};
}

/**
 * Escape hatch — full session control for oddballs whose lifecycles don't
 * fit any sugar (eyedropper, move). The author writes `open()` directly and
 * returns a `StrokeSession`.
 *
 * `legacy` carries the `kind` discriminator plus any kind-specific methods
 * (e.g. `applyTransform` for `dragTransform`) that the `DrawTool` union
 * still requires pre-commit-11. Drops when `DrawTool` becomes opaque.
 */
export function customTool<Legacy extends LiveSampleTool | DragTransformTool>(spec: {
	id: ToolType;
	legacy: Legacy;
	open(host: SessionHost, spec: StrokeSpec): StrokeSession;
}): Legacy & AuthoredTool {
	return {
		...spec.legacy,
		id: spec.id,
		open: spec.open
	} as Legacy & AuthoredTool;
}
