import type { WasmPixelCanvas } from '$wasm/dotorixel_wasm';
import type { CanvasCoords } from './view-types';
import type { Color } from './color';
import type { SharedState } from './shared-state.svelte';

// ── ToolEffect: what ToolRunner reports back to its caller ──────────

export type ToolEffect =
	| { readonly type: 'canvasChanged' }
	| { readonly type: 'canvasReplaced'; readonly canvas: WasmPixelCanvas }
	| { readonly type: 'colorPick'; readonly target: 'foreground' | 'background'; readonly color: Color }
	| { readonly type: 'addRecentColor'; readonly hex: string };

export type ToolEffects = readonly ToolEffect[];

// ── ToolRunnerHost: read-only queries ToolRunner needs from EditorState ──

export interface ToolRunnerHost {
	readonly pixelCanvas: WasmPixelCanvas;
	readonly foregroundColor: Color;
	readonly backgroundColor: Color;
}

// ── ToolRunner: owns tool dispatch, draw state, and history ─────────

export interface ToolRunner {
	readonly isDrawing: boolean;
	readonly canUndo: boolean;
	readonly canRedo: boolean;

	drawStart(button: number): ToolEffects;
	draw(current: CanvasCoords, previous: CanvasCoords | null): ToolEffects;
	drawEnd(): ToolEffects;
	modifierChanged(): ToolEffects;

	undo(): ToolEffects;
	redo(): ToolEffects;
	clear(): ToolEffects;
	pushSnapshot(): void;

	/** Wire isShiftHeld after KeyboardInput is created to break circular dependency. */
	connectModifiers(modifiers: { isShiftHeld(): boolean }): void;
}

// ── Factory ─────────────────────────────────────────────────────────

export function createToolRunner(_host: ToolRunnerHost, _shared: SharedState): ToolRunner {
	throw new Error('createToolRunner not yet implemented');
}
