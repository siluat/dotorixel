import type { PixelCanvas } from '../canvas-model';
import type { CanvasFactory, CanvasConstraints, HistoryManager } from '../adapter-types';
import type { ViewportOps } from '../viewport';
import type { DrawingOps } from '../drawing-ops';

/**
 * Umbrella port for the drawing-engine adapters used by the editor session
 * layers (TabState, Workspace). Consumers inject a single `CanvasBackend`
 * instead of wiring each sub-port individually.
 *
 * Production adapter: `wasmBackend` from `../wasm-backend.ts` — composed
 * from the existing per-port WASM exports. Tests also inject `wasmBackend`
 * directly; WASM runs cleanly under happy-dom so no in-memory fake is kept.
 */
export interface CanvasBackend {
	readonly canvasFactory: CanvasFactory;
	readonly canvasConstraints: CanvasConstraints;
	readonly viewportOps: ViewportOps;
	createHistoryManager(): HistoryManager;
	createDrawingOps(getCanvas: () => PixelCanvas): DrawingOps;
}
