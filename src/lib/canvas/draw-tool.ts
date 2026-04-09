import type { PixelCanvas } from './canvas-model';
import type { CanvasCoords } from './canvas-model';
import type { Color } from './color';

// ── ToolEffect: what drawing tools report back ────────────────────

/** Effects that drawing tools can produce. */
export type ToolEffect =
	| { readonly type: 'canvasChanged' }
	| { readonly type: 'colorPick'; readonly target: 'foreground' | 'background'; readonly color: Color }
	| { readonly type: 'addRecentColor'; readonly hex: string };

export type ToolEffects = readonly ToolEffect[];

/** Pre-allocated constant for the most common return: canvas pixels changed. */
export const CANVAS_CHANGED: ToolEffects = [{ type: 'canvasChanged' }];

/** Pre-allocated constant for no-op returns. */
export const NO_EFFECTS: ToolEffects = [];

// ── ToolContext ───────────────────────────────────────────────────

/** Read-only snapshot of editor state that tools need during a draw stroke. */
export interface ToolContext {
	readonly canvas: PixelCanvas;
	/** Pre-resolved draw color (left click = foreground, right click = background). */
	readonly drawColor: Color;
	/** 0 = left click, 2 = right click. */
	readonly drawButton: number;
	/** Live read of shift key state — function so shape tools get the current value mid-stroke. */
	readonly isShiftHeld: () => boolean;
	readonly foregroundColor: Color;
	readonly backgroundColor: Color;
}

// ── DrawTool: discriminated union of 4 tool categories ───────────

/** Paints pixels every frame along the drag path. (pencil, eraser) */
export interface ContinuousTool {
	readonly kind: 'continuous';
	/** Whether ToolRunner should add the active drawing color to recent colors on stroke start. */
	readonly addsActiveColor: boolean;
	/** Returns true if any pixel was changed. */
	apply(ctx: ToolContext, current: CanvasCoords, previous: CanvasCoords | null): boolean;
}

/** Fires once on click, ignores drag. (floodfill, eyedropper) */
export interface OneShotTool {
	readonly kind: 'oneShot';
	/** Whether ToolRunner should push a history snapshot before this tool fires. */
	readonly capturesHistory: boolean;
	/** Whether ToolRunner should add the active drawing color to recent colors on click. */
	readonly addsActiveColor: boolean;
	/** Called exactly once per click. */
	execute(ctx: ToolContext, target: CanvasCoords): ToolEffects;
}

/** Snapshot-restore live preview with shift-constraint. (line, rect, ellipse) */
export interface ShapePreviewTool {
	readonly kind: 'shapePreview';
	/** Whether ToolRunner should add the active drawing color to recent colors on stroke start. */
	readonly addsActiveColor: boolean;
	/** Constrains `end` when shift is held (e.g., snap to 45° or force square). */
	readonly constrainFn: (start: CanvasCoords, end: CanvasCoords) => CanvasCoords;
	/** Stamps the initial anchor pixel. ToolRunner emits canvasChanged. */
	onAnchor(ctx: ToolContext, start: CanvasCoords): void;
	/** Draws the shape preview. ToolRunner restores the snapshot before calling, then emits canvasChanged. */
	onPreview(ctx: ToolContext, start: CanvasCoords, end: CanvasCoords): void;
}

/** Snapshot-restore with cumulative drag delta. (move) */
export interface DragTransformTool {
	readonly kind: 'dragTransform';
	/** Applies the transform using the snapshot. ToolRunner emits canvasChanged after this call. */
	applyTransform(
		ctx: ToolContext,
		snapshot: Uint8Array,
		start: CanvasCoords,
		current: CanvasCoords
	): void;
}

/** Union of all tool categories. */
export type DrawTool = ContinuousTool | OneShotTool | ShapePreviewTool | DragTransformTool;
