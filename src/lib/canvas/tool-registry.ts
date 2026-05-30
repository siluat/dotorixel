import type { CanvasCoords } from './canvas-model';
import type { DrawTool } from './tool-authoring';
import { pencilTool, eraserTool } from './tools/pencil-tool';
import { floodfillTool } from './tools/floodfill-tool';
import { eyedropperTool } from './tools/eyedropper-tool';
import { moveTool } from './tools/move-tool';
import { selectionTool } from './tools/selection-tool';
import { lineTool, rectangleTool, ellipseTool } from './tools/shape-tool';

// ── Constrain helpers ──────────────────────────────────────────────

/** Snaps `end` to the nearest 45° multiple direction from `start` (8-directional). */
export function constrainLine(start: CanvasCoords, end: CanvasCoords): CanvasCoords {
	const dx = end.x - start.x;
	const dy = end.y - start.y;
	const absDx = Math.abs(dx);
	const absDy = Math.abs(dy);

	// Horizontal: angle close to 0° or 180°
	if (absDy * 2 <= absDx) {
		return { x: end.x, y: start.y };
	}

	// Vertical: angle close to 90° or 270°
	if (absDx * 2 <= absDy) {
		return { x: start.x, y: end.y };
	}

	// 45° diagonal: force |dx| = |dy| = max(|dx|, |dy|)
	const dist = Math.max(absDx, absDy);
	return {
		x: start.x + dist * Math.sign(dx),
		y: start.y + dist * Math.sign(dy)
	};
}

/** Forces the bounding box defined by `start` and `end` into a square. */
export function constrainSquare(start: CanvasCoords, end: CanvasCoords): CanvasCoords {
	const dx = end.x - start.x;
	const dy = end.y - start.y;
	const side = Math.max(Math.abs(dx), Math.abs(dy));

	return {
		x: start.x + side * (dx >= 0 ? 1 : -1),
		y: start.y + side * (dy >= 0 ? 1 : -1)
	};
}

// ── ToolDef ────────────────────────────────────────────────────────

/** Static metadata for a tool — everything known at module load time. */
export interface ToolDef {
	readonly cursor: string;
	readonly shortcutKey: string;
	readonly tool: DrawTool;
	readonly isDrawingTool: boolean;
	readonly isPixelMutationTool: boolean;
}

// ── Registry ───────────────────────────────────────────────────────

/**
 * Single source of truth for all tool definitions.
 * Keys determine ToolType union and toolbar display order.
 */
const TOOL_DEFS = {
	pencil: {
		cursor: 'crosshair',
		shortcutKey: 'P',
		tool: pencilTool,
		isDrawingTool: true,
		isPixelMutationTool: true
	},
	eraser: {
		cursor: 'crosshair',
		shortcutKey: 'E',
		tool: eraserTool,
		isDrawingTool: true,
		isPixelMutationTool: true
	},
	line: {
		cursor: 'crosshair',
		shortcutKey: 'L',
		tool: lineTool,
		isDrawingTool: true,
		isPixelMutationTool: true
	},
	rectangle: {
		cursor: 'crosshair',
		shortcutKey: 'U',
		tool: rectangleTool,
		isDrawingTool: true,
		isPixelMutationTool: true
	},
	ellipse: {
		cursor: 'crosshair',
		shortcutKey: 'O',
		tool: ellipseTool,
		isDrawingTool: true,
		isPixelMutationTool: true
	},
	floodfill: {
		cursor: 'crosshair',
		shortcutKey: 'F',
		tool: floodfillTool,
		isDrawingTool: true,
		isPixelMutationTool: true
	},
	eyedropper: {
		cursor: 'crosshair',
		shortcutKey: 'I',
		tool: eyedropperTool,
		isDrawingTool: false,
		isPixelMutationTool: false
	},
	move: {
		cursor: 'move',
		shortcutKey: 'V',
		tool: moveTool,
		isDrawingTool: false,
		isPixelMutationTool: true
	},
	selection: {
		cursor: 'crosshair',
		shortcutKey: 'M',
		tool: selectionTool,
		isDrawingTool: true,
		isPixelMutationTool: true
	}
} as const satisfies Record<string, ToolDef>;

// ── Derived exports ────────────────────────────────────────────────

/** Derived from registry keys — no separate maintenance. */
export type ToolType = keyof typeof TOOL_DEFS;

/** All tool types in display order. */
export const TOOL_TYPES: readonly ToolType[] = Object.keys(TOOL_DEFS) as ToolType[];

/** Look up a single tool's static definition. */
export function getToolDef(type: ToolType): ToolDef {
	return TOOL_DEFS[type];
}

/** Drawing tools paint, erase, fill, or preview pixels on a Pixel Layer. */
export function isDrawingTool(type: ToolType): boolean {
	return TOOL_DEFS[type].isDrawingTool;
}

/** Tools whose stroke lifecycle must be blocked while a Reference Layer is active. */
export function isPixelMutationTool(type: ToolType): boolean {
	return TOOL_DEFS[type].isPixelMutationTool;
}

/** Collect all DrawTool instances. Called once at engine construction. */
export function createAllTools(): Record<ToolType, DrawTool> {
	return Object.fromEntries(
		TOOL_TYPES.map((type) => [type, TOOL_DEFS[type].tool])
	) as Record<ToolType, DrawTool>;
}

/** Derived: CSS cursor per tool. */
export const TOOL_CURSORS: Record<ToolType, string> = Object.fromEntries(
	TOOL_TYPES.map((type) => [type, TOOL_DEFS[type].cursor])
) as Record<ToolType, string>;

/** Derived: display shortcut key per tool. */
export const TOOL_SHORTCUT_KEYS: Record<ToolType, string> = Object.fromEntries(
	TOOL_TYPES.map((type) => [type, TOOL_DEFS[type].shortcutKey])
) as Record<ToolType, string>;

/** Derived: KeyboardEvent.code → ToolType. */
export const TOOL_SHORTCUTS: Record<string, ToolType> = Object.fromEntries(
	TOOL_TYPES.map((type) => [`Key${TOOL_DEFS[type].shortcutKey}`, type])
) as Record<string, ToolType>;

/** Validates a string as a registered ToolType. */
export function isValidToolType(value: string): value is ToolType {
	return Object.hasOwn(TOOL_DEFS, value);
}
