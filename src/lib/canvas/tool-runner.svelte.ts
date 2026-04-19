import type { PixelCanvas, CanvasCoords } from './canvas-model';
import type { Color } from './color';
import type { SharedState } from './shared-state.svelte';
import { CANVAS_CHANGED, NO_EFFECTS, type ToolEffect } from './draw-tool';
import { createAllTools } from './tool-registry';
import type { PointerType } from './canvas-interaction.svelte';
import type { SamplingSession } from './sampling-session.svelte';
import type { LoupeInputSource } from './loupe-position';
import { createDrawingOps, canvasFactory, createHistoryManager } from './wasm-backend';
import { createStrokeSessions, type StrokeSession, type StrokeSessions } from './stroke-session';

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

	/**
	 * The runner maps `pen` → `mouse` for the loupe `inputSource` because pens
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
	/** Session shared with the Loupe overlay; LiveSampleTool delegates to it. */
	readonly samplingSession: SamplingSession;
}

export function createToolRunner(deps: ToolRunnerDeps): ToolRunner {
	const { host, shared, getShiftHeld, samplingSession } = deps;

	// ── DrawingOps (bound to current canvas) ────────────────────────
	const ops = createDrawingOps(() => host.pixelCanvas);

	// ── Tool instances ──────────────────────────────────────────────
	const tools = createAllTools(ops);

	// ── History ─────────────────────────────────────────────────────
	const history = createHistoryManager();
	let historyVersion = $state(0);

	// ── Draw state ──────────────────────────────────────────────────
	let isDrawing = $state(false);
	let drawButton = 0;
	let activeDrawColor: Color | null = null;
	let activeInputSource: LoupeInputSource = 'mouse';
	let activeSession: StrokeSession | null = null;

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

	// ── StrokeSessions: typed openers, one per DrawTool.kind ────────
	const sessions: StrokeSessions = createStrokeSessions({
		host,
		baseOps: ops,
		history: { pushSnapshot: pushHistorySnapshot },
		sampling: samplingSession,
		isShiftHeld: getShiftHeld,
		pixelPerfect: () => shared.pixelPerfect
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
			drawButton = button;
			activeDrawColor = button === 2 ? host.backgroundColor : host.foregroundColor;
			// `pen` shares the mouse offset preset; only `touch` uses the
			// larger touch offset to clear finger occlusion.
			activeInputSource = pointerType === 'touch' ? 'touch' : 'mouse';
			const tool = tools[shared.activeTool];

			switch (tool.kind) {
				case 'liveSample':
					activeSession = sessions.liveSample({
						drawButton: button,
						inputSource: activeInputSource
					});
					break;
				case 'dragTransform':
					activeSession = sessions.dragTransform({
						tool,
						drawColor: activeDrawColor,
						drawButton: button
					});
					break;
				case 'shapePreview':
					activeSession = sessions.shapePreview({
						tool,
						drawColor: activeDrawColor,
						drawButton: button
					});
					break;
				case 'oneShot':
					activeSession = sessions.oneShot({
						tool,
						drawColor: activeDrawColor,
						drawButton: button
					});
					break;
				case 'continuous':
					activeSession = sessions.continuous({
						tool,
						drawColor: activeDrawColor,
						drawButton: button
					});
					break;
				default:
					// Exhaustive guard: new DrawTool kinds must be handled above or
					// `activeSession` stays null and `start()` below would crash.
					tool satisfies never;
					throw new Error(
						`tool-runner: unhandled tool kind "${(tool as { kind: string }).kind}"`
					);
			}
			return activeSession.start();
		},

		draw(current: CanvasCoords, previous: CanvasCoords | null): EditorEffects {
			if (!isDrawing || !activeSession) return NO_EFFECTS;
			return activeSession.draw(current, previous);
		},

		drawEnd(): EditorEffects {
			if (!isDrawing) return NO_EFFECTS;
			const endEffects = activeSession ? activeSession.end() : NO_EFFECTS;
			activeSession = null;
			isDrawing = false;
			drawButton = 0;
			activeDrawColor = null;
			activeInputSource = 'mouse';
			return endEffects;
		},

		modifierChanged(): EditorEffects {
			if (!isDrawing || !activeSession) return NO_EFFECTS;
			return activeSession.modifierChanged();
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
