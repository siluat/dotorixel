import type { PixelCanvas } from './pixel-canvas';
import type { CanvasCoords } from './canvas-types';
import type { Color } from './color';
import { colorToHex } from './color';
import type { SharedState } from './shared-state.svelte';
import { CANVAS_CHANGED, NO_EFFECTS, type DrawTool, type ToolContext, type ToolEffect } from './draw-tool';
import { createPencilTool, createEraserTool } from './tools/pencil-tool';
import { createFloodfillTool } from './tools/floodfill-tool';
import { eyedropperTool } from './tools/eyedropper-tool';
import { moveTool } from './tools/move-tool';
import { createShapeTool } from './tools/shape-tool';
import { constrainLine, constrainSquare } from './constrain';
import type { ToolType } from './tool-types';
import { createDrawingOps, canvasFactory, createHistoryManager } from './wasm-backend';

// ── Effects: ToolRunner adds RunnerEffect on top of tool-produced ToolEffect ──

/** Effects that only ToolRunner can produce (undo/redo infrastructure). */
export type RunnerEffect =
	| { readonly type: 'canvasReplaced'; readonly canvas: PixelCanvas };

/** Union of all effects EditorState must handle. */
export type EditorEffect = ToolEffect | RunnerEffect;

export type EditorEffects = readonly EditorEffect[];

// ── ToolRunnerHost: read-only queries ToolRunner needs from EditorState ──

export interface ToolRunnerHost {
	readonly pixelCanvas: PixelCanvas;
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
}

// ── Factory ─────────────────────────────────────────────────────────

export interface ToolRunnerDeps {
	readonly host: ToolRunnerHost;
	readonly shared: SharedState;
	readonly getShiftHeld: () => boolean;
}

export function createToolRunner(deps: ToolRunnerDeps): ToolRunner {
	const { host, shared, getShiftHeld } = deps;

	// ── DrawingOps (bound to current canvas) ────────────────────────
	const ops = createDrawingOps(() => host.pixelCanvas);

	// ── Tool registry ───────────────────────────────────────────────
	const tools: Record<ToolType, DrawTool> = {
		pencil: createPencilTool(ops),
		eraser: createEraserTool(ops),
		line: createShapeTool(ops, 'line', ops.interpolatePixels, constrainLine),
		rectangle: createShapeTool(ops, 'rectangle', ops.rectangleOutline, constrainSquare),
		ellipse: createShapeTool(ops, 'ellipse', ops.ellipseOutline, constrainSquare),
		floodfill: createFloodfillTool(ops),
		eyedropper: eyedropperTool,
		move: moveTool
	};

	// ── History ─────────────────────────────────────────────────────
	const history = createHistoryManager();
	let historyVersion = $state(0);

	// ── Draw state ──────────────────────────────────────────────────
	let isDrawing = $state(false);
	let drawButton = 0;
	let activeDrawColor: Color | null = null;

	// ── Stroke state (owned by ToolRunner, not by tools) ────────────
	let strokeSnapshot: Uint8Array | null = null;
	let strokeAnchor: CanvasCoords | null = null;
	let lastDrawCurrent: CanvasCoords | null = null;

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
			isShiftHeld: getShiftHeld,
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
			const newCanvas = canvasFactory.fromPixels(snapshot.width, snapshot.height, snapshot.pixels());
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
			strokeSnapshot = null;
			strokeAnchor = null;
			lastDrawCurrent = null;

			const isRightClick = button === 2;
			activeDrawColor = isRightClick ? host.backgroundColor : host.foregroundColor;

			const tool = tools[shared.activeTool];
			const effects: ToolEffect[] = [];

			// History: push snapshot based on category policy
			if (tool.kind === 'oneShot') {
				if (tool.capturesHistory) pushHistorySnapshot();
			} else {
				pushHistorySnapshot();
			}

			// Recent color: declarative flag (dragTransform has no addsActiveColor)
			if (tool.kind !== 'dragTransform' && tool.addsActiveColor) {
				const color = drawButton === 2 ? host.backgroundColor : host.foregroundColor;
				effects.push({ type: 'addRecentColor', hex: colorToHex(color) });
			}

			// Snapshot: capture for preview/transform categories
			if (tool.kind === 'shapePreview' || tool.kind === 'dragTransform') {
				strokeSnapshot = new Uint8Array(host.pixelCanvas.pixels());
			}

			return effects;
		},

		draw(current: CanvasCoords, previous: CanvasCoords | null): EditorEffects {
			if (!isDrawing) return NO_EFFECTS;
			lastDrawCurrent = current;

			const tool = tools[shared.activeTool];
			const ctx = buildContext();

			switch (tool.kind) {
				case 'continuous': {
					const changed = tool.apply(ctx, current, previous);
					return changed ? CANVAS_CHANGED : NO_EFFECTS;
				}

				case 'oneShot': {
					if (strokeAnchor !== null) return NO_EFFECTS;
					strokeAnchor = current;
					return tool.execute(ctx, current);
				}

				case 'shapePreview': {
					if (previous === null) {
						strokeAnchor = current;
						tool.onAnchor(ctx, current);
						return CANVAS_CHANGED;
					}
					if (!strokeAnchor || !strokeSnapshot) return NO_EFFECTS;
					host.pixelCanvas.restore_pixels(strokeSnapshot);
					const end = getShiftHeld() ? tool.constrainFn(strokeAnchor, current) : current;
					tool.onPreview(ctx, strokeAnchor, end);
					return CANVAS_CHANGED;
				}

				case 'dragTransform': {
					if (previous === null) {
						strokeAnchor = current;
						return NO_EFFECTS;
					}
					if (!strokeAnchor || !strokeSnapshot) return NO_EFFECTS;
					tool.applyTransform(ctx, strokeSnapshot, strokeAnchor, current);
					return CANVAS_CHANGED;
				}
			}
		},

		drawEnd(): EditorEffects {
			if (!isDrawing) return NO_EFFECTS;
			isDrawing = false;
			drawButton = 0;
			activeDrawColor = null;
			strokeSnapshot = null;
			strokeAnchor = null;
			lastDrawCurrent = null;
			return NO_EFFECTS;
		},

		modifierChanged(): EditorEffects {
			if (!isDrawing || !lastDrawCurrent) return NO_EFFECTS;
			const tool = tools[shared.activeTool];
			if (tool.kind !== 'shapePreview') return NO_EFFECTS;
			if (!strokeAnchor || !strokeSnapshot) return NO_EFFECTS;

			const ctx = buildContext();
			host.pixelCanvas.restore_pixels(strokeSnapshot);
			const end = getShiftHeld() ? tool.constrainFn(strokeAnchor, lastDrawCurrent) : lastDrawCurrent;
			tool.onPreview(ctx, strokeAnchor, end);
			return CANVAS_CHANGED;
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
		}
	};
}
