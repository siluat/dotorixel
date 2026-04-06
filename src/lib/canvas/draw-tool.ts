import type { WasmPixelCanvas, WasmColor } from '$wasm/dotorixel_wasm';
import type { CanvasCoords } from './view-types';
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
	readonly canvas: WasmPixelCanvas;
	/** Pre-resolved draw color (left click = foreground, right click = background). */
	readonly drawColor: WasmColor;
	/** 0 = left click, 2 = right click. */
	readonly drawButton: number;
	/** Live read of shift key state — function so shape tools get the current value mid-stroke. */
	readonly isShiftHeld: () => boolean;
	readonly foregroundColor: Color;
	readonly backgroundColor: Color;
}

/** Lifecycle interface for drawing tools. */
export interface DrawTool {
	/** Whether EditorState should push a history snapshot before this tool's stroke begins. */
	readonly capturesHistory: boolean;

	onDrawStart(context: ToolContext): ToolEffects;
	onDraw(context: ToolContext, current: CanvasCoords, previous: CanvasCoords | null): ToolEffects;
	onDrawEnd(context: ToolContext): void;

	/**
	 * Called when a modifier key (Shift) changes mid-stroke.
	 * Shape tools use this to redraw with/without constraints.
	 */
	onModifierChange?(context: ToolContext, current: CanvasCoords): ToolEffects;
}
