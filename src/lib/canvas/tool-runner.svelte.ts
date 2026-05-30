import type { Document, CanvasPoint } from './canvas-model';
import type { Color } from './color';
import type { SharedState } from './shared-state.svelte';
import { NO_EFFECTS, type ToolEffect } from './draw-tool';
import type { PointerType } from './canvas-interaction.svelte';
import type { SamplingSession } from './sampling/session.svelte';
import { createStrokeEngine, type ActiveStroke } from './stroke-engine';

export type EditorEffects = readonly ToolEffect[];

// ── ToolRunnerHost: read-only queries ToolRunner needs from TabState ──

export interface ToolRunnerHost {
	readonly document: Document;
	readonly foregroundColor: Color;
	readonly backgroundColor: Color;
}

// ── ToolRunner: owns tool dispatch and draw state ───────────────────

export interface ToolRunner {
	readonly isDrawing: boolean;

	/**
	 * The engine maps `pen` → `mouse` for the loupe `inputSource` because pens
	 * share the mouse offset preset.
	 */
	drawStart(button: number, pointerType: PointerType): EditorEffects;
	draw(current: CanvasPoint, previous: CanvasPoint | null): EditorEffects;
	drawEnd(): EditorEffects;
	drawCancel(): EditorEffects;
	modifierChanged(): EditorEffects;
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

	// ── Draw state ──────────────────────────────────────────────────
	let isDrawing = $state(false);
	let activeStroke: ActiveStroke | null = null;

	// ── Stroke engine: resolves active tool + opens sessions ────────
	const engine = createStrokeEngine({
		host,
		shared,
		sampling: samplingSession,
		isShiftHeld: getShiftHeld
	});

	// ── Public interface ────────────────────────────────────────────

	return {
		get isDrawing(): boolean {
			return isDrawing;
		},

		drawStart(button: number, pointerType: PointerType): EditorEffects {
			isDrawing = true;
			const { stroke, effects } = engine.begin({ button, pointerType });
			activeStroke = stroke;
			return effects;
		},

		draw(current: CanvasPoint, previous: CanvasPoint | null): EditorEffects {
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

		drawCancel(): EditorEffects {
			if (!isDrawing) return NO_EFFECTS;
			const cancelEffects = activeStroke ? activeStroke.cancel() : NO_EFFECTS;
			activeStroke = null;
			isDrawing = false;
			return cancelEffects;
		},

		modifierChanged(): EditorEffects {
			if (!isDrawing || !activeStroke) return NO_EFFECTS;
			return activeStroke.refresh();
		}
	};
}
