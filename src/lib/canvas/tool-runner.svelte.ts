import type { PixelCanvas, CanvasCoords } from './canvas-model';
import type { Color } from './color';
import type { SharedState } from './shared-state.svelte';
import { CANVAS_CHANGED, NO_EFFECTS, type ToolEffect } from './draw-tool';
import type { PointerType } from './canvas-interaction.svelte';
import type { SamplingSession } from './sampling-session.svelte';
import { canvasFactory, createHistoryManager } from './wasm-backend';
import { createStrokeEngine, type ActiveStroke } from './stroke-engine';

// ── Effects: ToolRunner adds RunnerEffect on top of tool-produced ToolEffect ──

/** Effects that only ToolRunner can produce (undo/redo infrastructure). */
export type RunnerEffect =
	| { readonly type: 'canvasReplaced'; readonly canvas: PixelCanvas };

/** Union of all effects TabState must handle. */
export type EditorEffect = ToolEffect | RunnerEffect;

export type EditorEffects = readonly EditorEffect[];

// ── ToolRunnerHost: read-only queries ToolRunner needs from TabState ──

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

	/**
	 * The engine maps `pen` → `mouse` for the loupe `inputSource` because pens
	 * share the mouse offset preset.
	 */
	drawStart(button: number, pointerType: PointerType): EditorEffects;
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
	/** Session shared with the Loupe overlay; the eyedropper tool delegates to it. */
	readonly samplingSession: SamplingSession;
}

export function createToolRunner(deps: ToolRunnerDeps): ToolRunner {
	const { host, shared, getShiftHeld, samplingSession } = deps;

	// ── History ─────────────────────────────────────────────────────
	const history = createHistoryManager();
	let historyVersion = $state(0);

	// ── Draw state ──────────────────────────────────────────────────
	let isDrawing = $state(false);
	let activeStroke: ActiveStroke | null = null;

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

	// ── Stroke engine: resolves active tool + opens sessions ────────
	const engine = createStrokeEngine({
		host,
		shared,
		history: { pushSnapshot: pushHistorySnapshot },
		sampling: samplingSession,
		isShiftHeld: getShiftHeld
	});

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

		drawStart(button: number, pointerType: PointerType): EditorEffects {
			isDrawing = true;
			const { stroke, effects } = engine.begin({ button, pointerType });
			activeStroke = stroke;
			return effects;
		},

		draw(current: CanvasCoords, previous: CanvasCoords | null): EditorEffects {
			if (!isDrawing || !activeStroke) return NO_EFFECTS;
			return activeStroke.sample(current, previous);
		},

		drawEnd(): EditorEffects {
			if (!isDrawing) return NO_EFFECTS;
			const endEffects = activeStroke ? activeStroke.end() : NO_EFFECTS;
			activeStroke = null;
			isDrawing = false;
			return endEffects;
		},

		modifierChanged(): EditorEffects {
			if (!isDrawing || !activeStroke) return NO_EFFECTS;
			return activeStroke.refresh();
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
