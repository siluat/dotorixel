import type { PixelCanvas, CanvasCoords } from './canvas-model';
import type { Color } from './color';
import { colorToHex } from './color';
import type { SharedState } from './shared-state.svelte';
import {
	CANVAS_CHANGED,
	NO_EFFECTS,
	type ContinuousTool,
	type OneShotTool,
	type ShapePreviewTool,
	type DragTransformTool,
	type LiveSampleTool,
	type DrawTool,
	type ToolContext,
	type ToolEffect
} from './draw-tool';
import type { ToolType } from './tool-registry';
import { createAllTools } from './tool-registry';
import type { PointerType } from './canvas-interaction.svelte';
import type { SamplingSession } from './sampling-session.svelte';
import type { LoupeInputSource } from './loupe-position';
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
	let activeLifecycle: StrokeLifecycle | null = null;

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

	// ── StrokeLifecycle: category-specific stroke policies ──────────

	interface StrokeLifecycle {
		start(ctx: ToolContext): EditorEffects;
		draw(ctx: ToolContext, current: CanvasCoords, previous: CanvasCoords | null): EditorEffects;
		modifierChanged(ctx: ToolContext): EditorEffects;
		/** Called when the stroke ends. Returns any effects produced on release (e.g. live-sample commit). */
		end(): EditorEffects;
	}

	function continuousLifecycle(tool: ContinuousTool, pushHistory: () => void): StrokeLifecycle {
		return {
			start(ctx) {
				pushHistory();
				return tool.addsActiveColor
					? [{ type: 'addRecentColor', hex: colorToHex(ctx.drawColor) }]
					: NO_EFFECTS;
			},
			draw(ctx, current, previous) {
				return tool.apply(ctx, current, previous) ? CANVAS_CHANGED : NO_EFFECTS;
			},
			modifierChanged() {
				return NO_EFFECTS;
			},
			end() {
				return NO_EFFECTS;
			}
		};
	}

	function oneShotLifecycle(tool: OneShotTool, pushHistory: () => void): StrokeLifecycle {
		let fired = false;
		return {
			start(ctx) {
				if (tool.capturesHistory) pushHistory();
				return tool.addsActiveColor
					? [{ type: 'addRecentColor', hex: colorToHex(ctx.drawColor) }]
					: NO_EFFECTS;
			},
			draw(ctx, current) {
				if (fired) return NO_EFFECTS;
				fired = true;
				return tool.execute(ctx, current);
			},
			modifierChanged() {
				return NO_EFFECTS;
			},
			end() {
				return NO_EFFECTS;
			}
		};
	}

	function shapePreviewLifecycle(tool: ShapePreviewTool, pushHistory: () => void): StrokeLifecycle {
		let snapshot: Uint8Array | null = null;
		let anchor: CanvasCoords | null = null;
		let lastCurrent: CanvasCoords | null = null;

		function redraw(ctx: ToolContext): EditorEffects {
			if (!anchor || !snapshot) return NO_EFFECTS;
			host.pixelCanvas.restore_pixels(snapshot);
			const end = ctx.isShiftHeld() ? tool.constrainFn(anchor, lastCurrent!) : lastCurrent!;
			tool.onPreview(ctx, anchor, end);
			return CANVAS_CHANGED;
		}

		return {
			start(ctx) {
				pushHistory();
				snapshot = new Uint8Array(host.pixelCanvas.pixels());
				return tool.addsActiveColor
					? [{ type: 'addRecentColor', hex: colorToHex(ctx.drawColor) }]
					: NO_EFFECTS;
			},
			draw(ctx, current, previous) {
				lastCurrent = current;
				if (previous === null) {
					anchor = current;
					tool.onAnchor(ctx, current);
					return CANVAS_CHANGED;
				}
				return redraw(ctx);
			},
			modifierChanged(ctx) {
				if (!lastCurrent) return NO_EFFECTS;
				return redraw(ctx);
			},
			end() {
				snapshot = null;
				anchor = null;
				lastCurrent = null;
				return NO_EFFECTS;
			}
		};
	}

	function dragTransformLifecycle(tool: DragTransformTool, pushHistory: () => void): StrokeLifecycle {
		let snapshot: Uint8Array | null = null;
		let anchor: CanvasCoords | null = null;

		return {
			start() {
				pushHistory();
				snapshot = new Uint8Array(host.pixelCanvas.pixels());
				return NO_EFFECTS;
			},
			draw(ctx, current, previous) {
				if (previous === null) {
					anchor = current;
					return NO_EFFECTS;
				}
				if (!anchor || !snapshot) return NO_EFFECTS;
				tool.applyTransform(ctx, snapshot, anchor, current);
				return CANVAS_CHANGED;
			},
			modifierChanged() {
				return NO_EFFECTS;
			},
			end() {
				snapshot = null;
				anchor = null;
				return NO_EFFECTS;
			}
		};
	}

	function liveSampleLifecycle(_tool: LiveSampleTool): StrokeLifecycle {
		let started = false;
		return {
			start() {
				// Deferred to first draw: samplingSession needs the initial target pixel.
				return NO_EFFECTS;
			},
			draw(ctx, current) {
				if (!started) {
					const commitTarget = ctx.drawButton === 2 ? 'background' : 'foreground';
					samplingSession.start({
						targetPixel: current,
						commitTarget,
						inputSource: activeInputSource
					});
					started = true;
				} else {
					samplingSession.update(current);
				}
				return NO_EFFECTS;
			},
			modifierChanged() {
				return NO_EFFECTS;
			},
			end() {
				const effects = samplingSession.commit();
				started = false;
				return effects;
			}
		};
	}

	function resolveLifecycle(tool: DrawTool, pushHistory: () => void): StrokeLifecycle {
		switch (tool.kind) {
			case 'continuous':
				return continuousLifecycle(tool, pushHistory);
			case 'oneShot':
				return oneShotLifecycle(tool, pushHistory);
			case 'shapePreview':
				return shapePreviewLifecycle(tool, pushHistory);
			case 'dragTransform':
				return dragTransformLifecycle(tool, pushHistory);
			case 'liveSample':
				return liveSampleLifecycle(tool);
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

		drawStart(button: number, pointerType: PointerType): EditorEffects {
			isDrawing = true;
			drawButton = button;
			activeDrawColor = button === 2 ? host.backgroundColor : host.foregroundColor;
			// `pen` shares the mouse offset preset; only `touch` uses the
			// larger touch offset to clear finger occlusion.
			activeInputSource = pointerType === 'touch' ? 'touch' : 'mouse';
			activeLifecycle = resolveLifecycle(tools[shared.activeTool], pushHistorySnapshot);
			return activeLifecycle.start(buildContext());
		},

		draw(current: CanvasCoords, previous: CanvasCoords | null): EditorEffects {
			if (!isDrawing || !activeLifecycle) return NO_EFFECTS;
			return activeLifecycle.draw(buildContext(), current, previous);
		},

		drawEnd(): EditorEffects {
			if (!isDrawing || !activeLifecycle) return NO_EFFECTS;
			const endEffects = activeLifecycle.end();
			activeLifecycle = null;
			isDrawing = false;
			drawButton = 0;
			activeDrawColor = null;
			activeInputSource = 'mouse';
			return endEffects;
		},

		modifierChanged(): EditorEffects {
			if (!isDrawing || !activeLifecycle) return NO_EFFECTS;
			return activeLifecycle.modifierChanged(buildContext());
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
