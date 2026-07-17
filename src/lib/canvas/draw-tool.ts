import type { Color } from './color';
import type { DrawingOps } from './drawing-ops';
import type { MarqueeRegion } from './canvas-model';

// ── ToolEffect: what drawing tools report back ────────────────────

/** Effects that drawing tools can produce. */
export type ToolEffect =
	| { readonly type: 'beginEdit' }
	| { readonly type: 'canvasChanged' }
	| { readonly type: 'colorPick'; readonly target: 'foreground' | 'background'; readonly color: Color }
	| { readonly type: 'addRecentColor'; readonly hex: string }
	| { readonly type: 'marqueePreviewChanged' }
	| { readonly type: 'setMarquee'; readonly region: MarqueeRegion | null }
	| { readonly type: 'beginFloatingSelection'; readonly sourceRegion: MarqueeRegion }
	| {
			readonly type: 'moveFloatingSelection';
			readonly offset: { readonly dx: number; readonly dy: number };
	  }
	| { readonly type: 'cancelFloatingSelection' };

export type ToolEffects = readonly ToolEffect[];

/** Pre-allocated constant for the most common return: canvas pixels changed. */
export const CANVAS_CHANGED: ToolEffects = [{ type: 'canvasChanged' }];

/** Opens the Edit Baseline: the journal holds the current document pending. */
export const BEGIN_EDIT: ToolEffects = [{ type: 'beginEdit' }];

export const MARQUEE_PREVIEW_CHANGED: ToolEffects = [{ type: 'marqueePreviewChanged' }];

/** Pre-allocated constant for no-op returns. */
export const NO_EFFECTS: ToolEffects = [];

// ── ToolContext ───────────────────────────────────────────────────

/** Read-only snapshot of editor state that tools need during a draw stroke. */
export interface ToolContext {
	/**
	 * The drawing operations to use for this stroke. May be a stroke-scoped
	 * decorator (e.g. pixel-perfect wrapper) chosen by the sugar constructor
	 * at stroke begin. Tools that paint pixels should call into this rather
	 * than capturing ops at tool-construction time.
	 */
	readonly ops: DrawingOps;
	/** Pre-resolved draw color (left click = foreground, right click = background). */
	readonly drawColor: Color;
	/** 0 = left click, 2 = right click. */
	readonly drawButton: number;
	/** Live read of shift key state — function so shape tools get the current value mid-stroke. */
	readonly isShiftHeld: () => boolean;
	readonly foregroundColor: Color;
	readonly backgroundColor: Color;
}
