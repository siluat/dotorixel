import { describe, it, expect } from 'vitest';
import {
	constrainLine,
	constrainSquare,
	TOOL_TYPES,
	TOOL_CURSORS,
	TOOL_SHORTCUT_KEYS,
	TOOL_SHORTCUTS,
	getToolDef,
	createAllTools,
	isValidToolType
} from './tool-registry';
import { createDrawingOps, canvasFactory } from './wasm-backend';

// ── constrainLine ──────────────────────────────────────────────────

describe('constrainLine', () => {
	const start = { x: 4, y: 4 };

	it('snaps to East (0°)', () => {
		expect(constrainLine(start, { x: 7, y: 5 })).toEqual({ x: 7, y: 4 });
	});

	it('snaps to West (180°)', () => {
		expect(constrainLine(start, { x: 1, y: 3 })).toEqual({ x: 1, y: 4 });
	});

	it('snaps to South (90°)', () => {
		expect(constrainLine(start, { x: 5, y: 7 })).toEqual({ x: 4, y: 7 });
	});

	it('snaps to North (270°)', () => {
		expect(constrainLine(start, { x: 3, y: 1 })).toEqual({ x: 4, y: 1 });
	});

	it('snaps to NE (45°)', () => {
		expect(constrainLine(start, { x: 7, y: 1 })).toEqual({ x: 7, y: 1 });
	});

	it('snaps to SE (135°)', () => {
		expect(constrainLine(start, { x: 7, y: 7 })).toEqual({ x: 7, y: 7 });
	});

	it('snaps to SW (225°)', () => {
		expect(constrainLine(start, { x: 1, y: 7 })).toEqual({ x: 1, y: 7 });
	});

	it('snaps to NW (315°)', () => {
		expect(constrainLine(start, { x: 1, y: 1 })).toEqual({ x: 1, y: 1 });
	});

	it('returns start when start === end', () => {
		expect(constrainLine(start, { x: 4, y: 4 })).toEqual({ x: 4, y: 4 });
	});

	it('forces diagonal distance to max(|dx|, |dy|)', () => {
		expect(constrainLine(start, { x: 7, y: 6 })).toEqual({ x: 7, y: 7 });
	});
});

// ── constrainSquare ────────────────────────────────────────────────

describe('constrainSquare', () => {
	const start = { x: 2, y: 2 };

	it('constrains to square in quadrant I (+x, +y)', () => {
		expect(constrainSquare(start, { x: 5, y: 4 })).toEqual({ x: 5, y: 5 });
	});

	it('constrains to square in quadrant II (-x, +y)', () => {
		expect(constrainSquare(start, { x: 0, y: 4 })).toEqual({ x: 0, y: 4 });
	});

	it('constrains to square in quadrant III (-x, -y)', () => {
		expect(constrainSquare(start, { x: 0, y: 1 })).toEqual({ x: 0, y: 0 });
	});

	it('constrains to square in quadrant IV (+x, -y)', () => {
		expect(constrainSquare(start, { x: 5, y: 1 })).toEqual({ x: 5, y: -1 });
	});

	it('returns start when start === end', () => {
		expect(constrainSquare(start, { x: 2, y: 2 })).toEqual({ x: 2, y: 2 });
	});
});

// ── Registry completeness ──────────────────────────────────────────

describe('tool registry', () => {
	it('every tool type has a non-empty cursor', () => {
		for (const type of TOOL_TYPES) {
			expect(TOOL_CURSORS[type]).toBeTruthy();
		}
	});

	it('every tool type has a non-empty shortcut key', () => {
		for (const type of TOOL_TYPES) {
			expect(TOOL_SHORTCUT_KEYS[type]).toBeTruthy();
		}
	});

	it('TOOL_SHORTCUTS maps each key code to the correct tool type', () => {
		for (const type of TOOL_TYPES) {
			const def = getToolDef(type);
			expect(TOOL_SHORTCUTS[`Key${def.shortcutKey}`]).toBe(type);
		}
	});

	it('createAllTools returns entries for all tool types', () => {
		const canvas = canvasFactory.create(8, 8);
		const ops = createDrawingOps(() => canvas);
		const tools = createAllTools(ops);

		for (const type of TOOL_TYPES) {
			expect(tools[type]).toBeDefined();
			expect(tools[type].kind).toBeTruthy();
		}
	});

	it('every registered tool exposes a callable open()', () => {
		const canvas = canvasFactory.create(8, 8);
		const ops = createDrawingOps(() => canvas);
		const tools = createAllTools(ops);

		for (const type of TOOL_TYPES) {
			const tool = tools[type] as unknown as { open?: unknown };
			expect(typeof tool.open).toBe('function');
		}
	});

	it('isValidToolType accepts registered types and rejects unknown', () => {
		for (const type of TOOL_TYPES) {
			expect(isValidToolType(type)).toBe(true);
		}
		expect(isValidToolType('nonexistent')).toBe(false);
	});
});
