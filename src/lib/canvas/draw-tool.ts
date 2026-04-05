import type { WasmPixelCanvas, WasmColor } from '$wasm/dotorixel_wasm';
import type { CanvasCoords } from './view-types';
import type { Color } from './color';

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

/** What a tool reports back to EditorState after a draw call. */
export interface DrawResult {
	readonly canvasChanged: boolean;
	readonly colorPick?: { readonly target: 'foreground' | 'background'; readonly color: Color };
	readonly addRecentColor?: string;
}

export const EMPTY_RESULT: DrawResult = { canvasChanged: false };

/** Lifecycle interface for drawing tools. */
export interface DrawTool {
	/** Whether EditorState should push a history snapshot before this tool's stroke begins. */
	readonly capturesHistory: boolean;

	onDrawStart(context: ToolContext): DrawResult;
	onDraw(context: ToolContext, current: CanvasCoords, previous: CanvasCoords | null): DrawResult;
	onDrawEnd(context: ToolContext): void;

	/**
	 * Called when a modifier key (Shift) changes mid-stroke.
	 * Shape tools use this to redraw with/without constraints.
	 */
	onModifierChange?(context: ToolContext, current: CanvasCoords): DrawResult;
}
