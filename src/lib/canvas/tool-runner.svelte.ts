import {
	WasmPixelCanvas,
	WasmHistoryManager,
	WasmColor,
	WasmToolType,
	wasm_interpolate_pixels,
	wasm_rectangle_outline,
	wasm_ellipse_outline
} from '$wasm/dotorixel_wasm';
import type { CanvasCoords } from './view-types';
import type { Color } from './color';
import type { SharedState } from './shared-state.svelte';
import { CANVAS_CHANGED, NO_EFFECTS, type DrawTool, type ToolContext, type ToolEffect } from './draw-tool';
import { pencilTool, eraserTool } from './tools/pencil-tool';
import { floodfillTool } from './tools/floodfill-tool';
import { eyedropperTool } from './tools/eyedropper-tool';
import { createMoveTool } from './tools/move-tool';
import { createShapeTool } from './tools/shape-tool';
import { constrainLine, constrainSquare } from './constrain';
import type { ToolType } from './tool-types';

// ── Effects: ToolRunner adds RunnerEffect on top of tool-produced ToolEffect ──

/** Effects that only ToolRunner can produce (undo/redo infrastructure). */
export type RunnerEffect =
	| { readonly type: 'canvasReplaced'; readonly canvas: WasmPixelCanvas };

/** Union of all effects EditorState must handle. */
export type EditorEffect = ToolEffect | RunnerEffect;

export type EditorEffects = readonly EditorEffect[];

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

	drawStart(button: number): EditorEffects;
	draw(current: CanvasCoords, previous: CanvasCoords | null): EditorEffects;
	drawEnd(): EditorEffects;
	modifierChanged(): EditorEffects;

	undo(): EditorEffects;
	redo(): EditorEffects;
	clear(): EditorEffects;
	pushSnapshot(): void;

	/** Wire isShiftHeld after KeyboardInput is created to break circular dependency. */
	connectModifiers(modifiers: { isShiftHeld(): boolean }): void;
}

// ── Factory ─────────────────────────────────────────────────────────

export function createToolRunner(host: ToolRunnerHost, shared: SharedState): ToolRunner {
	// ── Tool registry ───────────────────────────────────────────────
	const tools: Record<ToolType, DrawTool> = {
		pencil: pencilTool,
		eraser: eraserTool,
		line: createShapeTool(WasmToolType.Line, wasm_interpolate_pixels, constrainLine),
		rectangle: createShapeTool(WasmToolType.Rectangle, wasm_rectangle_outline, constrainSquare),
		ellipse: createShapeTool(WasmToolType.Ellipse, wasm_ellipse_outline, constrainSquare),
		floodfill: floodfillTool,
		eyedropper: eyedropperTool,
		move: createMoveTool()
	};

	// ── History ─────────────────────────────────────────────────────
	const history = WasmHistoryManager.default_manager();
	let historyVersion = $state(0);

	// ── Draw state ──────────────────────────────────────────────────
	let isDrawing = $state(false);
	let drawButton = 0;
	let activeDrawColor: WasmColor | null = null;
	let lastDrawCurrent: CanvasCoords | null = null;

	// ── Modifier provider (wired via connectModifiers) ──────────────
	let shiftHeldProvider: (() => boolean) | null = null;

	// ── Derived WASM colors ─────────────────────────────────────────
	const wasmForegroundColor = $derived(
		new WasmColor(
			host.foregroundColor.r,
			host.foregroundColor.g,
			host.foregroundColor.b,
			host.foregroundColor.a
		)
	);

	const wasmBackgroundColor = $derived(
		new WasmColor(
			host.backgroundColor.r,
			host.backgroundColor.g,
			host.backgroundColor.b,
			host.backgroundColor.a
		)
	);

	// ── Derived reactive properties ─────────────────────────────────
	const canUndo = $derived.by(() => {
		void historyVersion;
		return history.can_undo();
	});

	const canRedo = $derived.by(() => {
		void historyVersion;
		return history.can_redo();
	});

	// ── Internal helpers ────────────────────────────────────────────

	function buildContext(): ToolContext {
		return {
			canvas: host.pixelCanvas,
			drawColor: activeDrawColor!,
			drawButton,
			isShiftHeld: () => shiftHeldProvider?.() ?? false,
			foregroundColor: host.foregroundColor,
			backgroundColor: host.backgroundColor
		};
	}

	function pushHistorySnapshot(): void {
		const canvas = host.pixelCanvas;
		history.push_snapshot(canvas.width, canvas.height, canvas.pixels());
		historyVersion++;
	}

	function applySnapshot(snapshot: { width: number; height: number; pixels(): Uint8Array }): EditorEffects {
		const canvas = host.pixelCanvas;
		const hasDimensionsChanged =
			snapshot.width !== canvas.width || snapshot.height !== canvas.height;
		if (hasDimensionsChanged) {
			const newCanvas = WasmPixelCanvas.from_pixels(snapshot.width, snapshot.height, snapshot.pixels());
			historyVersion++;
			return [{ type: 'canvasReplaced', canvas: newCanvas }];
		} else {
			canvas.restore_pixels(snapshot.pixels());
			historyVersion++;
			return CANVAS_CHANGED;
		}
	}

	// ── Public interface ────────────────────────────────────────────

	return {
		get isDrawing(): boolean {
			return isDrawing;
		},

		get canUndo(): boolean {
			return canUndo;
		},

		get canRedo(): boolean {
			return canRedo;
		},

		drawStart(button: number): EditorEffects {
			isDrawing = true;
			drawButton = button;
			lastDrawCurrent = null;

			const isRightClick = button === 2;
			activeDrawColor = isRightClick ? wasmBackgroundColor : wasmForegroundColor;

			const tool = tools[shared.activeTool];
			if (tool.capturesHistory) {
				pushHistorySnapshot();
			}
			return tool.onDrawStart(buildContext());
		},

		draw(current: CanvasCoords, previous: CanvasCoords | null): EditorEffects {
			if (!isDrawing) return NO_EFFECTS;
			lastDrawCurrent = current;
			return tools[shared.activeTool].onDraw(buildContext(), current, previous);
		},

		drawEnd(): EditorEffects {
			if (!isDrawing) return NO_EFFECTS;
			tools[shared.activeTool].onDrawEnd(buildContext());
			isDrawing = false;
			drawButton = 0;
			activeDrawColor = null;
			lastDrawCurrent = null;
			return NO_EFFECTS;
		},

		modifierChanged(): EditorEffects {
			if (!isDrawing || !lastDrawCurrent) return NO_EFFECTS;
			const tool = tools[shared.activeTool];
			if (!tool.onModifierChange) return NO_EFFECTS;
			return tool.onModifierChange(buildContext(), lastDrawCurrent);
		},

		undo(): EditorEffects {
			if (isDrawing) return NO_EFFECTS;
			const canvas = host.pixelCanvas;
			const snapshot = history.undo(canvas.width, canvas.height, canvas.pixels());
			if (!snapshot) return NO_EFFECTS;
			return applySnapshot(snapshot);
		},

		redo(): EditorEffects {
			if (isDrawing) return NO_EFFECTS;
			const canvas = host.pixelCanvas;
			const snapshot = history.redo(canvas.width, canvas.height, canvas.pixels());
			if (!snapshot) return NO_EFFECTS;
			return applySnapshot(snapshot);
		},

		clear(): EditorEffects {
			pushHistorySnapshot();
			host.pixelCanvas.clear();
			return CANVAS_CHANGED;
		},

		pushSnapshot(): void {
			pushHistorySnapshot();
		},

		connectModifiers(modifiers: { isShiftHeld(): boolean }): void {
			shiftHeldProvider = modifiers.isShiftHeld;
		}
	};
}
