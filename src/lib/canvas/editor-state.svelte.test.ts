// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { EditorState } from './editor-state.svelte';
import { TOOL_CURSORS, type ToolType } from './tool-registry';
import type { CanvasCoords } from './canvas-model';

function createEditor() {
	return new EditorState({ canvasWidth: 8, canvasHeight: 8 });
}

function getPixel(editor: EditorState, x: number, y: number) {
	const pixel = editor.pixelCanvas.get_pixel(x, y);
	return { r: pixel.r, g: pixel.g, b: pixel.b, a: pixel.a };
}

const BLACK = { r: 0, g: 0, b: 0, a: 255 };
const WHITE = { r: 255, g: 255, b: 255, a: 255 };
const TRANSPARENT = { r: 0, g: 0, b: 0, a: 0 };

function drawLine(editor: EditorState, from: CanvasCoords, to: CanvasCoords) {
	editor.activeTool = 'line';
	editor.handleDrawStart(0, 'mouse');
	editor.handleDraw(from, null);
	editor.handleDraw(to, from);
	editor.handleDrawEnd();
}

function drawRectangle(editor: EditorState, from: CanvasCoords, to: CanvasCoords) {
	editor.activeTool = 'rectangle';
	editor.handleDrawStart(0, 'mouse');
	editor.handleDraw(from, null);
	editor.handleDraw(to, from);
	editor.handleDrawEnd();
}

function drawEllipse(editor: EditorState, from: CanvasCoords, to: CanvasCoords) {
	editor.activeTool = 'ellipse';
	editor.handleDrawStart(0, 'mouse');
	editor.handleDraw(from, null);
	editor.handleDraw(to, from);
	editor.handleDrawEnd();
}

describe('EditorState — line tool', () => {
	it('draws a line from start to end', () => {
		const editor = createEditor();
		drawLine(editor, { x: 0, y: 0 }, { x: 3, y: 0 });

		expect(getPixel(editor, 0, 0)).toEqual(BLACK);
		expect(getPixel(editor, 1, 0)).toEqual(BLACK);
		expect(getPixel(editor, 2, 0)).toEqual(BLACK);
		expect(getPixel(editor, 3, 0)).toEqual(BLACK);
	});

	it('does not leave intermediate preview artifacts', () => {
		const editor = createEditor();
		editor.activeTool = 'line';
		editor.handleDrawStart(0, 'mouse');

		const start: CanvasCoords = { x: 0, y: 0 };
		editor.handleDraw(start, null);

		// Drag through an intermediate point
		const mid: CanvasCoords = { x: 4, y: 4 };
		editor.handleDraw(mid, start);

		// Intermediate preview: pixels along (0,0)→(4,4) should be drawn
		expect(getPixel(editor, 2, 2)).toEqual(BLACK);

		// Now move to final position — different from mid
		const end: CanvasCoords = { x: 3, y: 0 };
		editor.handleDraw(end, mid);

		// The intermediate diagonal pixels should be restored (snapshot-restore)
		expect(getPixel(editor, 2, 2)).toEqual(TRANSPARENT);

		// Final line pixels should be present
		expect(getPixel(editor, 0, 0)).toEqual(BLACK);
		expect(getPixel(editor, 1, 0)).toEqual(BLACK);
		expect(getPixel(editor, 2, 0)).toEqual(BLACK);
		expect(getPixel(editor, 3, 0)).toEqual(BLACK);

		editor.handleDrawEnd();
	});

	it('undoes entire line as one operation', () => {
		const editor = createEditor();
		drawLine(editor, { x: 0, y: 0 }, { x: 3, y: 0 });

		// All pixels drawn
		expect(getPixel(editor, 0, 0)).toEqual(BLACK);
		expect(getPixel(editor, 3, 0)).toEqual(BLACK);

		editor.handleUndo();

		// All pixels restored to transparent
		expect(getPixel(editor, 0, 0)).toEqual(TRANSPARENT);
		expect(getPixel(editor, 1, 0)).toEqual(TRANSPARENT);
		expect(getPixel(editor, 2, 0)).toEqual(TRANSPARENT);
		expect(getPixel(editor, 3, 0)).toEqual(TRANSPARENT);
	});

	it('updates recentColors when drawing a line', () => {
		const editor = createEditor();
		expect(editor.recentColors).toEqual([]);

		drawLine(editor, { x: 0, y: 0 }, { x: 1, y: 0 });

		expect(editor.recentColors.length).toBeGreaterThan(0);
		expect(editor.recentColors).toContain('#000000');
	});
});

describe('EditorState — rectangle tool', () => {
	it('draws a rectangle outline', () => {
		const editor = createEditor();
		drawRectangle(editor, { x: 1, y: 1 }, { x: 3, y: 3 });

		// All 8 outline pixels of a 3×3 rectangle should be black
		expect(getPixel(editor, 1, 1)).toEqual(BLACK);
		expect(getPixel(editor, 2, 1)).toEqual(BLACK);
		expect(getPixel(editor, 3, 1)).toEqual(BLACK);
		expect(getPixel(editor, 1, 2)).toEqual(BLACK);
		expect(getPixel(editor, 3, 2)).toEqual(BLACK);
		expect(getPixel(editor, 1, 3)).toEqual(BLACK);
		expect(getPixel(editor, 2, 3)).toEqual(BLACK);
		expect(getPixel(editor, 3, 3)).toEqual(BLACK);

		// Interior should remain transparent
		expect(getPixel(editor, 2, 2)).toEqual(TRANSPARENT);
	});

	it('does not leave intermediate preview artifacts', () => {
		const editor = createEditor();
		editor.activeTool = 'rectangle';
		editor.handleDrawStart(0, 'mouse');

		const start: CanvasCoords = { x: 0, y: 0 };
		editor.handleDraw(start, null);

		// Drag to an intermediate point
		const mid: CanvasCoords = { x: 4, y: 4 };
		editor.handleDraw(mid, start);

		// Intermediate preview: outline pixels should be drawn
		expect(getPixel(editor, 2, 0)).toEqual(BLACK);

		// Move to final position — different from mid
		const end: CanvasCoords = { x: 2, y: 2 };
		editor.handleDraw(end, mid);

		// Previous preview should be cleaned up (snapshot-restore)
		expect(getPixel(editor, 4, 0)).toEqual(TRANSPARENT);
		expect(getPixel(editor, 0, 4)).toEqual(TRANSPARENT);

		// Final rectangle outline should be present
		expect(getPixel(editor, 0, 0)).toEqual(BLACK);
		expect(getPixel(editor, 1, 0)).toEqual(BLACK);
		expect(getPixel(editor, 2, 0)).toEqual(BLACK);
		expect(getPixel(editor, 0, 1)).toEqual(BLACK);
		expect(getPixel(editor, 2, 1)).toEqual(BLACK);
		expect(getPixel(editor, 0, 2)).toEqual(BLACK);
		expect(getPixel(editor, 1, 2)).toEqual(BLACK);
		expect(getPixel(editor, 2, 2)).toEqual(BLACK);

		editor.handleDrawEnd();
	});

	it('undoes entire rectangle as one operation', () => {
		const editor = createEditor();
		drawRectangle(editor, { x: 1, y: 1 }, { x: 3, y: 3 });

		expect(getPixel(editor, 1, 1)).toEqual(BLACK);
		expect(getPixel(editor, 3, 3)).toEqual(BLACK);

		editor.handleUndo();

		expect(getPixel(editor, 1, 1)).toEqual(TRANSPARENT);
		expect(getPixel(editor, 3, 3)).toEqual(TRANSPARENT);
		expect(getPixel(editor, 2, 1)).toEqual(TRANSPARENT);
	});

	it('updates recentColors when drawing a rectangle', () => {
		const editor = createEditor();
		expect(editor.recentColors).toEqual([]);

		drawRectangle(editor, { x: 0, y: 0 }, { x: 2, y: 2 });

		expect(editor.recentColors.length).toBeGreaterThan(0);
		expect(editor.recentColors).toContain('#000000');
	});
});

describe('EditorState — ellipse tool', () => {
	it('draws an ellipse outline', () => {
		const editor = createEditor();
		drawEllipse(editor, { x: 1, y: 1 }, { x: 5, y: 5 });

		// Axis endpoints of a 5×5 circle inscribed in (1,1)-(5,5)
		expect(getPixel(editor, 3, 1)).toEqual(BLACK); // top
		expect(getPixel(editor, 3, 5)).toEqual(BLACK); // bottom
		expect(getPixel(editor, 1, 3)).toEqual(BLACK); // left
		expect(getPixel(editor, 5, 3)).toEqual(BLACK); // right
	});

	it('does not leave intermediate preview artifacts', () => {
		const editor = createEditor();
		editor.activeTool = 'ellipse';
		editor.handleDrawStart(0, 'mouse');

		const start: CanvasCoords = { x: 0, y: 0 };
		editor.handleDraw(start, null);

		// Drag to intermediate point
		const mid: CanvasCoords = { x: 6, y: 6 };
		editor.handleDraw(mid, start);

		// Some intermediate ellipse pixel should be drawn
		expect(getPixel(editor, 3, 0)).toEqual(BLACK);

		// Move to final position
		const end: CanvasCoords = { x: 4, y: 4 };
		editor.handleDraw(end, mid);

		// Previous preview should be cleaned up
		expect(getPixel(editor, 6, 3)).toEqual(TRANSPARENT);

		// Final ellipse should be present
		expect(getPixel(editor, 2, 0)).toEqual(BLACK); // top axis

		editor.handleDrawEnd();
	});

	it('undoes entire ellipse as one operation', () => {
		const editor = createEditor();
		drawEllipse(editor, { x: 1, y: 1 }, { x: 5, y: 5 });

		expect(getPixel(editor, 3, 1)).toEqual(BLACK);
		expect(getPixel(editor, 1, 3)).toEqual(BLACK);

		editor.handleUndo();

		expect(getPixel(editor, 3, 1)).toEqual(TRANSPARENT);
		expect(getPixel(editor, 1, 3)).toEqual(TRANSPARENT);
	});

	it('updates recentColors when drawing an ellipse', () => {
		const editor = createEditor();
		expect(editor.recentColors).toEqual([]);

		drawEllipse(editor, { x: 0, y: 0 }, { x: 4, y: 4 });

		expect(editor.recentColors.length).toBeGreaterThan(0);
		expect(editor.recentColors).toContain('#000000');
	});
});

describe('EditorState — eyedropper tool', () => {
	it('picks the color of a painted pixel', () => {
		const editor = createEditor();
		const red = { r: 255, g: 0, b: 0, a: 255 };
		editor.foregroundColor = red;
		editor.activeTool = 'pencil';
		editor.handleDrawStart(0, 'mouse');
		editor.handleDraw({ x: 3, y: 3 }, null);
		editor.handleDrawEnd();

		// Switch to eyedropper and pick the red pixel
		editor.foregroundColor = BLACK;
		editor.activeTool = 'eyedropper';
		editor.handleDrawStart(0, 'mouse');
		editor.handleDraw({ x: 3, y: 3 }, null);
		editor.handleDrawEnd();

		expect(editor.foregroundColor).toEqual(red);
	});

	it('does not change foregroundColor when picking a transparent pixel', () => {
		const editor = createEditor();
		editor.activeTool = 'eyedropper';
		editor.handleDrawStart(0, 'mouse');
		editor.handleDraw({ x: 0, y: 0 }, null);
		editor.handleDrawEnd();

		expect(editor.foregroundColor).toEqual(BLACK);
	});

	it('does not push an undo snapshot', () => {
		const editor = createEditor();

		// Paint a pixel first so canUndo becomes true, then undo to reset
		editor.activeTool = 'pencil';
		editor.handleDrawStart(0, 'mouse');
		editor.handleDraw({ x: 0, y: 0 }, null);
		editor.handleDrawEnd();
		editor.handleUndo();
		expect(editor.canUndo).toBe(false);

		// Use eyedropper — should not create an undo entry
		editor.activeTool = 'eyedropper';
		editor.handleDrawStart(0, 'mouse');
		editor.handleDraw({ x: 0, y: 0 }, null);
		editor.handleDrawEnd();

		expect(editor.canUndo).toBe(false);
	});

	it('adds picked color to recentColors', () => {
		const editor = createEditor();
		const green = { r: 0, g: 128, b: 0, a: 255 };
		editor.foregroundColor = green;
		editor.activeTool = 'pencil';
		editor.handleDrawStart(0, 'mouse');
		editor.handleDraw({ x: 2, y: 2 }, null);
		editor.handleDrawEnd();

		editor.recentColors = [];
		editor.foregroundColor = BLACK;
		editor.activeTool = 'eyedropper';
		editor.handleDrawStart(0, 'mouse');
		editor.handleDraw({ x: 2, y: 2 }, null);
		editor.handleDrawEnd();

		expect(editor.recentColors).toContain('#008000');
	});
});

function keyDown(
	code: string,
	options: {
		key?: string;
		ctrlKey?: boolean;
		metaKey?: boolean;
		altKey?: boolean;
		shiftKey?: boolean;
		repeat?: boolean;
		target?: EventTarget | null;
	} = {}
): KeyboardEvent {
	return {
		code,
		key: options.key ?? '',
		ctrlKey: options.ctrlKey ?? false,
		metaKey: options.metaKey ?? false,
		altKey: options.altKey ?? false,
		shiftKey: options.shiftKey ?? false,
		repeat: options.repeat ?? false,
		target: options.target ?? null,
		preventDefault: () => {}
	} as unknown as KeyboardEvent;
}

function keyUp(code: string): KeyboardEvent {
	return {
		code,
		key: '',
		ctrlKey: false,
		metaKey: false,
		altKey: false,
		shiftKey: false,
		repeat: false,
		target: null,
		preventDefault: () => {}
	} as unknown as KeyboardEvent;
}

describe('EditorState — Alt eyedropper', () => {
	it('switches to eyedropper on Alt press and restores on release', () => {
		const editor = createEditor();
		editor.activeTool = 'pencil';

		editor.handleKeyDown(keyDown('AltLeft'));
		expect(editor.activeTool).toBe('eyedropper');

		editor.handleKeyUp(keyUp('AltLeft'));
		expect(editor.activeTool).toBe('pencil');
	});

	it('does not set toolBeforeModifier when already using eyedropper', () => {
		const editor = createEditor();
		editor.activeTool = 'eyedropper';

		editor.handleKeyDown(keyDown('AltLeft'));
		// Should stay as eyedropper
		expect(editor.activeTool).toBe('eyedropper');

		// Release should not change tool (no previous tool saved)
		editor.handleKeyUp(keyUp('AltLeft'));
		expect(editor.activeTool).toBe('eyedropper');
	});

	it('ignores Alt repeat events', () => {
		const editor = createEditor();
		editor.activeTool = 'eraser';

		editor.handleKeyDown(keyDown('AltLeft'));
		expect(editor.activeTool).toBe('eyedropper');

		// Repeat event should not re-save toolBeforeModifier
		editor.handleKeyDown(keyDown('AltLeft', { repeat: true }));
		expect(editor.activeTool).toBe('eyedropper');

		editor.handleKeyUp(keyUp('AltLeft'));
		expect(editor.activeTool).toBe('eraser');
	});

	it('does not switch tool when Alt is pressed during drawing', () => {
		const editor = createEditor();
		editor.activeTool = 'pencil';
		editor.handleDrawStart(0, 'mouse');
		editor.handleDraw({ x: 0, y: 0 }, null);

		editor.handleKeyDown(keyDown('AltLeft'));
		expect(editor.activeTool).toBe('pencil');

		editor.handleDrawEnd();
	});

	it('defers tool restore when Alt is released during drawing, restores on drawEnd', () => {
		const editor = createEditor();
		editor.activeTool = 'pencil';

		// Alt press → switch to eyedropper
		editor.handleKeyDown(keyDown('AltLeft'));
		expect(editor.activeTool).toBe('eyedropper');

		// Start drawing with eyedropper
		editor.handleDrawStart(0, 'mouse');

		// Release Alt while drawing → should NOT restore yet
		editor.handleKeyUp(keyUp('AltLeft'));
		expect(editor.activeTool).toBe('eyedropper');

		// drawEnd → should restore
		editor.handleDrawEnd();
		expect(editor.activeTool).toBe('pencil');
	});

	it('does not restore on drawEnd when Alt is still held', () => {
		const editor = createEditor();
		editor.activeTool = 'pencil';

		editor.handleKeyDown(keyDown('AltLeft'));
		expect(editor.activeTool).toBe('eyedropper');

		// Click with eyedropper while Alt held
		editor.handleDrawStart(0, 'mouse');
		editor.handleDraw({ x: 0, y: 0 }, null);
		editor.handleDrawEnd();

		// Alt still held → should remain eyedropper
		expect(editor.activeTool).toBe('eyedropper');

		// Release Alt → now restore
		editor.handleKeyUp(keyUp('AltLeft'));
		expect(editor.activeTool).toBe('pencil');
	});

	it('restores tool on window blur', () => {
		const editor = createEditor();
		editor.activeTool = 'line';

		editor.handleKeyDown(keyDown('AltLeft'));
		expect(editor.activeTool).toBe('eyedropper');

		editor.handleBlur();
		expect(editor.activeTool).toBe('line');
	});

	it('works with AltRight as well', () => {
		const editor = createEditor();
		editor.activeTool = 'rectangle';

		editor.handleKeyDown(keyDown('AltRight'));
		expect(editor.activeTool).toBe('eyedropper');

		editor.handleKeyUp(keyUp('AltRight'));
		expect(editor.activeTool).toBe('rectangle');
	});
});

describe('EditorState — swapColors', () => {
	it('swaps foreground and background colors', () => {
		const editor = createEditor();
		const initialFg = { ...editor.foregroundColor };
		const initialBg = { ...editor.backgroundColor };

		editor.swapColors();

		expect(editor.foregroundColor).toEqual(initialBg);
		expect(editor.backgroundColor).toEqual(initialFg);
	});

	it('defaults backgroundColor to white', () => {
		const editor = createEditor();
		expect(editor.backgroundColor).toEqual(WHITE);
	});

	it('accepts custom backgroundColor via EditorOptions', () => {
		const customBg = { r: 128, g: 64, b: 32, a: 255 };
		const editor = new EditorState({ canvasWidth: 8, canvasHeight: 8, backgroundColor: customBg });
		expect(editor.backgroundColor).toEqual(customBg);
	});

	it('is idempotent when swapped twice', () => {
		const editor = createEditor();
		const originalFg = { ...editor.foregroundColor };
		const originalBg = { ...editor.backgroundColor };

		editor.swapColors();
		editor.swapColors();

		expect(editor.foregroundColor).toEqual(originalFg);
		expect(editor.backgroundColor).toEqual(originalBg);
	});
});

describe('EditorState — Shift constrain', () => {
	it('constrains line to horizontal when Shift is held', () => {
		const editor = createEditor();
		editor.activeTool = 'line';

		editor.handleKeyDown(keyDown('ShiftLeft'));
		editor.handleDrawStart(0, 'mouse');
		editor.handleDraw({ x: 0, y: 0 }, null);
		editor.handleDraw({ x: 5, y: 1 }, { x: 0, y: 0 });
		editor.handleDrawEnd();
		editor.handleKeyUp(keyUp('ShiftLeft'));

		// Horizontal snap: y stays at 0
		expect(getPixel(editor, 3, 0)).toEqual(BLACK);
		expect(getPixel(editor, 0, 1)).toEqual(TRANSPARENT);
	});

	it('constrains line to vertical when Shift is held', () => {
		const editor = createEditor();
		editor.activeTool = 'line';

		editor.handleKeyDown(keyDown('ShiftLeft'));
		editor.handleDrawStart(0, 'mouse');
		editor.handleDraw({ x: 0, y: 0 }, null);
		editor.handleDraw({ x: 1, y: 5 }, { x: 0, y: 0 });
		editor.handleDrawEnd();
		editor.handleKeyUp(keyUp('ShiftLeft'));

		// Vertical snap: x stays at 0
		expect(getPixel(editor, 0, 3)).toEqual(BLACK);
		expect(getPixel(editor, 1, 0)).toEqual(TRANSPARENT);
	});

	it('constrains line to 45° diagonal when Shift is held', () => {
		const editor = createEditor();
		editor.activeTool = 'line';

		editor.handleKeyDown(keyDown('ShiftLeft'));
		editor.handleDrawStart(0, 'mouse');
		editor.handleDraw({ x: 0, y: 0 }, null);
		editor.handleDraw({ x: 4, y: 3 }, { x: 0, y: 0 });
		editor.handleDrawEnd();
		editor.handleKeyUp(keyUp('ShiftLeft'));

		// 45° snap: (0,0)→(4,4)
		expect(getPixel(editor, 2, 2)).toEqual(BLACK);
		expect(getPixel(editor, 4, 4)).toEqual(BLACK);
	});

	it('draws unconstrained line without Shift', () => {
		const editor = createEditor();
		drawLine(editor, { x: 0, y: 0 }, { x: 3, y: 1 });

		// Diagonal line, not snapped
		expect(getPixel(editor, 3, 1)).toEqual(BLACK);
	});

	it('constrains rectangle to square when Shift is held', () => {
		const editor = createEditor();
		editor.activeTool = 'rectangle';

		editor.handleKeyDown(keyDown('ShiftLeft'));
		editor.handleDrawStart(0, 'mouse');
		editor.handleDraw({ x: 0, y: 0 }, null);
		editor.handleDraw({ x: 3, y: 2 }, { x: 0, y: 0 });
		editor.handleDrawEnd();
		editor.handleKeyUp(keyUp('ShiftLeft'));

		// Constrained to 4×4 square (0,0)→(3,3)
		expect(getPixel(editor, 3, 3)).toEqual(BLACK);
		expect(getPixel(editor, 0, 3)).toEqual(BLACK);
	});

	it('constrains ellipse to circle when Shift is held', () => {
		const editor = createEditor();
		editor.activeTool = 'ellipse';

		editor.handleKeyDown(keyDown('ShiftLeft'));
		editor.handleDrawStart(0, 'mouse');
		editor.handleDraw({ x: 0, y: 0 }, null);
		editor.handleDraw({ x: 6, y: 4 }, { x: 0, y: 0 });
		editor.handleDrawEnd();
		editor.handleKeyUp(keyUp('ShiftLeft'));

		// Constrained to square bounding box (0,0)→(6,6) → circle
		expect(getPixel(editor, 3, 0)).toEqual(BLACK); // top
		expect(getPixel(editor, 3, 6)).toEqual(BLACK); // bottom
		expect(getPixel(editor, 0, 3)).toEqual(BLACK); // left
		expect(getPixel(editor, 6, 3)).toEqual(BLACK); // right
	});

	it('ignores Shift repeat events', () => {
		const editor = createEditor();
		editor.handleKeyDown(keyDown('ShiftLeft'));
		expect(editor.isShiftHeld).toBe(true);

		// Repeat should not cause issues
		editor.handleKeyDown(keyDown('ShiftLeft', { repeat: true }));
		expect(editor.isShiftHeld).toBe(true);

		editor.handleKeyUp(keyUp('ShiftLeft'));
		expect(editor.isShiftHeld).toBe(false);
	});

	it('resets isShiftHeld on window blur', () => {
		const editor = createEditor();
		editor.handleKeyDown(keyDown('ShiftLeft'));
		expect(editor.isShiftHeld).toBe(true);

		editor.handleBlur();
		expect(editor.isShiftHeld).toBe(false);
	});

	it('updates preview immediately when Shift is toggled during drawing', () => {
		const editor = createEditor();
		editor.activeTool = 'line';
		editor.handleDrawStart(0, 'mouse');
		editor.handleDraw({ x: 0, y: 0 }, null);
		editor.handleDraw({ x: 5, y: 1 }, { x: 0, y: 0 });

		// Without Shift: line goes to (5,1)
		expect(getPixel(editor, 5, 1)).toEqual(BLACK);

		// Press Shift mid-draw → should re-render constrained
		editor.handleKeyDown(keyDown('ShiftLeft'));

		// Now line should be horizontal: (0,0)→(5,0)
		expect(getPixel(editor, 5, 0)).toEqual(BLACK);
		expect(getPixel(editor, 5, 1)).toEqual(TRANSPARENT);

		// Release Shift → back to unconstrained
		editor.handleKeyUp(keyUp('ShiftLeft'));
		expect(getPixel(editor, 5, 1)).toEqual(BLACK);

		editor.handleDrawEnd();
	});

	it('does not affect pencil tool', () => {
		const editor = createEditor();
		editor.activeTool = 'pencil';

		editor.handleKeyDown(keyDown('ShiftLeft'));
		editor.handleDrawStart(0, 'mouse');
		editor.handleDraw({ x: 3, y: 5 }, null);
		editor.handleDrawEnd();
		editor.handleKeyUp(keyUp('ShiftLeft'));

		// Pencil draws at exact coordinates regardless of Shift
		expect(getPixel(editor, 3, 5)).toEqual(BLACK);
	});

	it('does not affect eraser tool', () => {
		const editor = createEditor();

		// Paint a pixel first
		editor.activeTool = 'pencil';
		editor.handleDrawStart(0, 'mouse');
		editor.handleDraw({ x: 3, y: 3 }, null);
		editor.handleDrawEnd();
		expect(getPixel(editor, 3, 3)).toEqual(BLACK);

		// Erase with Shift held
		editor.activeTool = 'eraser';
		editor.handleKeyDown(keyDown('ShiftLeft'));
		editor.handleDrawStart(0, 'mouse');
		editor.handleDraw({ x: 3, y: 3 }, null);
		editor.handleDrawEnd();
		editor.handleKeyUp(keyUp('ShiftLeft'));

		expect(getPixel(editor, 3, 3)).toEqual(TRANSPARENT);
	});

	it('works with ShiftRight as well', () => {
		const editor = createEditor();
		editor.handleKeyDown(keyDown('ShiftRight'));
		expect(editor.isShiftHeld).toBe(true);

		editor.handleKeyUp(keyUp('ShiftRight'));
		expect(editor.isShiftHeld).toBe(false);
	});
});

describe('EditorState — right-click draws with background color', () => {
	it('pencil right-click draws with background color', () => {
		const editor = createEditor();
		editor.activeTool = 'pencil';
		editor.handleDrawStart(2, 'mouse');
		editor.handleDraw({ x: 3, y: 3 }, null);
		editor.handleDrawEnd();

		expect(getPixel(editor, 3, 3)).toEqual(WHITE);
	});

	it('pencil left-click still draws with foreground color', () => {
		const editor = createEditor();
		editor.activeTool = 'pencil';
		editor.handleDrawStart(0, 'mouse');
		editor.handleDraw({ x: 3, y: 3 }, null);
		editor.handleDrawEnd();

		expect(getPixel(editor, 3, 3)).toEqual(BLACK);
	});

	it('eraser is unchanged on right-click', () => {
		const editor = createEditor();
		// Paint a pixel first
		editor.activeTool = 'pencil';
		editor.handleDrawStart(0, 'mouse');
		editor.handleDraw({ x: 2, y: 2 }, null);
		editor.handleDrawEnd();
		expect(getPixel(editor, 2, 2)).toEqual(BLACK);

		// Right-click eraser should still erase to transparent
		editor.activeTool = 'eraser';
		editor.handleDrawStart(2, 'mouse');
		editor.handleDraw({ x: 2, y: 2 }, null);
		editor.handleDrawEnd();

		expect(getPixel(editor, 2, 2)).toEqual(TRANSPARENT);
	});

	it('flood fill right-click uses background color', () => {
		const editor = createEditor();
		editor.activeTool = 'floodfill';
		editor.handleDrawStart(2, 'mouse');
		editor.handleDraw({ x: 0, y: 0 }, null);
		editor.handleDrawEnd();

		expect(getPixel(editor, 0, 0)).toEqual(WHITE);
		expect(getPixel(editor, 7, 7)).toEqual(WHITE);
	});

	it('line right-click draws with background color', () => {
		const editor = createEditor();
		editor.activeTool = 'line';
		editor.handleDrawStart(2, 'mouse');
		editor.handleDraw({ x: 0, y: 0 }, null);
		editor.handleDraw({ x: 3, y: 0 }, { x: 0, y: 0 });
		editor.handleDrawEnd();

		expect(getPixel(editor, 0, 0)).toEqual(WHITE);
		expect(getPixel(editor, 1, 0)).toEqual(WHITE);
		expect(getPixel(editor, 2, 0)).toEqual(WHITE);
		expect(getPixel(editor, 3, 0)).toEqual(WHITE);
	});

	it('rectangle right-click draws with background color', () => {
		const editor = createEditor();
		editor.activeTool = 'rectangle';
		editor.handleDrawStart(2, 'mouse');
		editor.handleDraw({ x: 1, y: 1 }, null);
		editor.handleDraw({ x: 3, y: 3 }, { x: 1, y: 1 });
		editor.handleDrawEnd();

		expect(getPixel(editor, 1, 1)).toEqual(WHITE);
		expect(getPixel(editor, 3, 3)).toEqual(WHITE);
	});

	it('ellipse right-click draws with background color', () => {
		const editor = createEditor();
		editor.activeTool = 'ellipse';
		editor.handleDrawStart(2, 'mouse');
		editor.handleDraw({ x: 1, y: 1 }, null);
		editor.handleDraw({ x: 5, y: 5 }, { x: 1, y: 1 });
		editor.handleDrawEnd();

		expect(getPixel(editor, 3, 1)).toEqual(WHITE); // top
		expect(getPixel(editor, 1, 3)).toEqual(WHITE); // left
	});

	it('eyedropper right-click sets background color', () => {
		const editor = createEditor();
		const red = { r: 255, g: 0, b: 0, a: 255 };
		editor.foregroundColor = red;
		editor.activeTool = 'pencil';
		editor.handleDrawStart(0, 'mouse');
		editor.handleDraw({ x: 3, y: 3 }, null);
		editor.handleDrawEnd();

		// Right-click eyedropper should set backgroundColor
		editor.foregroundColor = BLACK;
		editor.activeTool = 'eyedropper';
		editor.handleDrawStart(2, 'mouse');
		editor.handleDraw({ x: 3, y: 3 }, null);
		editor.handleDrawEnd();

		expect(editor.backgroundColor).toEqual(red);
		expect(editor.foregroundColor).toEqual(BLACK);
	});

	it('right-click adds background color to recentColors', () => {
		const editor = createEditor();
		editor.recentColors = [];
		editor.activeTool = 'pencil';
		editor.handleDrawStart(2, 'mouse');
		editor.handleDraw({ x: 0, y: 0 }, null);
		editor.handleDrawEnd();

		expect(editor.recentColors).toContain('#ffffff');
	});
});

describe('EditorState — resize undo/redo', () => {
	it('undoes resize and restores original dimensions', () => {
		const editor = createEditor(); // 8×8
		editor.handleResize(16, 16);
		expect(editor.pixelCanvas.width).toBe(16);
		expect(editor.pixelCanvas.height).toBe(16);

		editor.handleUndo();
		expect(editor.pixelCanvas.width).toBe(8);
		expect(editor.pixelCanvas.height).toBe(8);
	});

	it('redoes resize after undo', () => {
		const editor = createEditor();
		editor.handleResize(16, 16);
		editor.handleUndo();
		expect(editor.pixelCanvas.width).toBe(8);

		editor.handleRedo();
		expect(editor.pixelCanvas.width).toBe(16);
		expect(editor.pixelCanvas.height).toBe(16);
	});

	it('preserves pixel data across resize undo', () => {
		const editor = createEditor(); // 8×8
		// Draw a pixel
		editor.activeTool = 'pencil';
		editor.handleDrawStart(0, 'mouse');
		editor.handleDraw({ x: 0, y: 0 }, null);
		editor.handleDrawEnd();
		expect(getPixel(editor, 0, 0)).toEqual(BLACK);

		// Resize to 16×16
		editor.handleResize(16, 16);
		expect(editor.pixelCanvas.width).toBe(16);

		// Undo resize — pixel should still be there at original dimensions
		editor.handleUndo();
		expect(editor.pixelCanvas.width).toBe(8);
		expect(getPixel(editor, 0, 0)).toEqual(BLACK);
	});

	it('undoes draw-resize-draw chain correctly', () => {
		const editor = createEditor(); // 8×8
		// Draw at (0,0)
		editor.activeTool = 'pencil';
		editor.handleDrawStart(0, 'mouse');
		editor.handleDraw({ x: 0, y: 0 }, null);
		editor.handleDrawEnd();

		// Resize to 16×16
		editor.handleResize(16, 16);

		// Draw at (10,10) — only valid on 16×16 canvas
		editor.handleDrawStart(0, 'mouse');
		editor.handleDraw({ x: 10, y: 10 }, null);
		editor.handleDrawEnd();
		expect(getPixel(editor, 10, 10)).toEqual(BLACK);

		// Undo draw at (10,10) — still 16×16
		editor.handleUndo();
		expect(editor.pixelCanvas.width).toBe(16);
		expect(getPixel(editor, 10, 10)).toEqual(TRANSPARENT);

		// Undo resize — back to 8×8 with pixel at (0,0)
		editor.handleUndo();
		expect(editor.pixelCanvas.width).toBe(8);
		expect(getPixel(editor, 0, 0)).toEqual(BLACK);

		// Undo draw at (0,0) — empty 8×8
		editor.handleUndo();
		expect(getPixel(editor, 0, 0)).toEqual(TRANSPARENT);
	});

	it('undoes multiple resizes independently', () => {
		const editor = createEditor(); // 8×8
		editor.handleResize(16, 16);
		editor.handleResize(32, 32);
		expect(editor.pixelCanvas.width).toBe(32);

		editor.handleUndo();
		expect(editor.pixelCanvas.width).toBe(16);

		editor.handleUndo();
		expect(editor.pixelCanvas.width).toBe(8);
	});

	it('resize with same dimensions is a no-op for history', () => {
		const editor = createEditor(); // 8×8
		editor.handleResize(8, 8);
		expect(editor.canUndo).toBe(false);
	});

	it('resize clears redo stack', () => {
		const editor = createEditor();
		editor.activeTool = 'pencil';
		editor.handleDrawStart(0, 'mouse');
		editor.handleDraw({ x: 0, y: 0 }, null);
		editor.handleDrawEnd();

		editor.handleUndo();
		expect(editor.canRedo).toBe(true);

		// Resize should clear redo (via push_snapshot)
		editor.handleResize(16, 16);
		expect(editor.canRedo).toBe(false);
	});
});

function drawMove(editor: EditorState, from: CanvasCoords, to: CanvasCoords) {
	editor.activeTool = 'move';
	editor.handleDrawStart(0, 'mouse');
	editor.handleDraw(from, null);
	editor.handleDraw(to, from);
	editor.handleDrawEnd();
}

describe('EditorState — move tool', () => {
	it('shifts canvas content to new position', () => {
		const editor = createEditor(); // 8×8
		editor.activeTool = 'pencil';
		editor.handleDrawStart(0, 'mouse');
		editor.handleDraw({ x: 0, y: 0 }, null);
		editor.handleDrawEnd();
		expect(getPixel(editor, 0, 0)).toEqual(BLACK);

		drawMove(editor, { x: 0, y: 0 }, { x: 2, y: 3 });

		expect(getPixel(editor, 2, 3)).toEqual(BLACK);
		expect(getPixel(editor, 0, 0)).toEqual(TRANSPARENT);
	});

	it('clips pixels shifted off canvas', () => {
		const editor = createEditor(); // 8×8
		editor.activeTool = 'pencil';
		editor.handleDrawStart(0, 'mouse');
		editor.handleDraw({ x: 7, y: 7 }, null);
		editor.handleDrawEnd();

		drawMove(editor, { x: 0, y: 0 }, { x: 1, y: 0 });

		// Pixel at (7,7) shifted to (8,7) — off canvas
		expect(getPixel(editor, 7, 7)).toEqual(TRANSPARENT);
	});

	it('fills vacated areas with transparent', () => {
		const editor = createEditor(); // 8×8
		// Fill entire top row
		editor.activeTool = 'pencil';
		for (let x = 0; x < 8; x++) {
			editor.handleDrawStart(0, 'mouse');
			editor.handleDraw({ x, y: 0 }, null);
			editor.handleDrawEnd();
		}

		drawMove(editor, { x: 0, y: 0 }, { x: 0, y: 1 });

		// Top row should be transparent
		for (let x = 0; x < 8; x++) {
			expect(getPixel(editor, x, 0)).toEqual(TRANSPARENT);
		}
		// Second row should have the moved pixels
		for (let x = 0; x < 8; x++) {
			expect(getPixel(editor, x, 1)).toEqual(BLACK);
		}
	});

	it('undoes entire move as one operation', () => {
		const editor = createEditor();
		editor.activeTool = 'pencil';
		editor.handleDrawStart(0, 'mouse');
		editor.handleDraw({ x: 1, y: 1 }, null);
		editor.handleDrawEnd();

		drawMove(editor, { x: 0, y: 0 }, { x: 3, y: 3 });
		expect(getPixel(editor, 4, 4)).toEqual(BLACK);
		expect(getPixel(editor, 1, 1)).toEqual(TRANSPARENT);

		editor.handleUndo();
		expect(getPixel(editor, 1, 1)).toEqual(BLACK);
		expect(getPixel(editor, 4, 4)).toEqual(TRANSPARENT);
	});

	it('does not update recentColors', () => {
		const editor = createEditor();
		const colorsBefore = [...editor.recentColors];

		drawMove(editor, { x: 0, y: 0 }, { x: 1, y: 1 });

		expect(editor.recentColors).toEqual(colorsBefore);
	});

	it('zero-delta move leaves pixels unchanged', () => {
		const editor = createEditor();
		editor.activeTool = 'pencil';
		editor.handleDrawStart(0, 'mouse');
		editor.handleDraw({ x: 3, y: 3 }, null);
		editor.handleDrawEnd();

		drawMove(editor, { x: 3, y: 3 }, { x: 3, y: 3 });

		expect(getPixel(editor, 3, 3)).toEqual(BLACK);
	});
});

describe('EditorState — long-press eyedropper', () => {
	it('picks foreground color on long-press (button 0)', () => {
		const editor = createEditor();
		const red = { r: 255, g: 0, b: 0, a: 255 };
		editor.foregroundColor = red;
		editor.activeTool = 'pencil';
		editor.handleDrawStart(0, 'mouse');
		editor.handleDraw({ x: 3, y: 3 }, null);
		editor.handleDrawEnd();

		editor.foregroundColor = BLACK;
		const result = editor.handleLongPress({ x: 3, y: 3 }, 0);

		expect(editor.foregroundColor).toEqual(red);
		expect(result).toBe(true);
	});

	it('picks background color on long-press (button 2)', () => {
		const editor = createEditor();
		const red = { r: 255, g: 0, b: 0, a: 255 };
		editor.foregroundColor = red;
		editor.activeTool = 'pencil';
		editor.handleDrawStart(0, 'mouse');
		editor.handleDraw({ x: 3, y: 3 }, null);
		editor.handleDrawEnd();

		const result = editor.handleLongPress({ x: 3, y: 3 }, 2);

		expect(editor.backgroundColor).toEqual(red);
		expect(result).toBe(true);
	});

	it('returns true without changing color on transparent pixel', () => {
		const editor = createEditor();
		const result = editor.handleLongPress({ x: 0, y: 0 }, 0);

		expect(editor.foregroundColor).toEqual(BLACK);
		expect(result).toBe(true);
	});

	it('adds picked color to recentColors', () => {
		const editor = createEditor();
		const green = { r: 0, g: 128, b: 0, a: 255 };
		editor.foregroundColor = green;
		editor.activeTool = 'pencil';
		editor.handleDrawStart(0, 'mouse');
		editor.handleDraw({ x: 2, y: 2 }, null);
		editor.handleDrawEnd();

		editor.recentColors = [];
		editor.handleLongPress({ x: 2, y: 2 }, 0);

		expect(editor.recentColors).toContain('#008000');
	});

	it('preserves current tool', () => {
		const editor = createEditor();
		editor.foregroundColor = WHITE;
		editor.activeTool = 'pencil';
		editor.handleDrawStart(0, 'mouse');
		editor.handleDraw({ x: 0, y: 0 }, null);
		editor.handleDrawEnd();

		editor.activeTool = 'line';
		editor.handleLongPress({ x: 0, y: 0 }, 0);

		expect(editor.activeTool).toBe('line');
	});

	it('returns false when eyedropper is already active', () => {
		const editor = createEditor();
		editor.activeTool = 'eyedropper';

		const result = editor.handleLongPress({ x: 0, y: 0 }, 0);

		expect(result).toBe(false);
	});

	it('does not create an undo snapshot', () => {
		const editor = createEditor();
		editor.activeTool = 'pencil';
		editor.handleDrawStart(0, 'mouse');
		editor.handleDraw({ x: 0, y: 0 }, null);
		editor.handleDrawEnd();
		editor.handleUndo();
		expect(editor.canUndo).toBe(false);

		editor.handleLongPress({ x: 0, y: 0 }, 0);

		expect(editor.canUndo).toBe(false);
	});
});

describe('toolCursor', () => {
	it('defaults to crosshair for pencil tool', () => {
		const editor = createEditor();
		expect(editor.toolCursor).toBe('crosshair');
	});

	it('returns move cursor for move tool', () => {
		const editor = createEditor();
		editor.activeTool = 'move';
		expect(editor.toolCursor).toBe('move');
	});

	it('has a cursor mapped for every tool type', () => {
		const allTools: ToolType[] = [
			'pencil', 'eraser', 'line', 'rectangle', 'ellipse', 'floodfill', 'eyedropper', 'move'
		];
		for (const tool of allTools) {
			expect(TOOL_CURSORS[tool]).toBeTruthy();
		}
	});
});

describe('EditorState — isExportUIOpen', () => {
	it('defaults to false', () => {
		const editor = createEditor();
		expect(editor.isExportUIOpen).toBe(false);
	});

	it('toggles from false to true', () => {
		const editor = createEditor();
		editor.toggleExportUI();
		expect(editor.isExportUIOpen).toBe(true);
	});

	it('toggles back to false', () => {
		const editor = createEditor();
		editor.toggleExportUI();
		editor.toggleExportUI();
		expect(editor.isExportUIOpen).toBe(false);
	});
});
