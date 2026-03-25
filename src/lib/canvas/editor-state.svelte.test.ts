import { describe, it, expect } from 'vitest';
import { EditorState } from './editor-state.svelte';
import type { CanvasCoords } from './view-types';

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
	editor.handleDrawStart();
	editor.handleDraw(from, null);
	editor.handleDraw(to, from);
	editor.handleDrawEnd();
}

function drawRectangle(editor: EditorState, from: CanvasCoords, to: CanvasCoords) {
	editor.activeTool = 'rectangle';
	editor.handleDrawStart();
	editor.handleDraw(from, null);
	editor.handleDraw(to, from);
	editor.handleDrawEnd();
}

function drawEllipse(editor: EditorState, from: CanvasCoords, to: CanvasCoords) {
	editor.activeTool = 'ellipse';
	editor.handleDrawStart();
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
		editor.handleDrawStart();

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
		editor.handleDrawStart();

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
		editor.handleDrawStart();

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
		editor.handleDrawStart();
		editor.handleDraw({ x: 3, y: 3 }, null);
		editor.handleDrawEnd();

		// Switch to eyedropper and pick the red pixel
		editor.foregroundColor = BLACK;
		editor.activeTool = 'eyedropper';
		editor.handleDrawStart();
		editor.handleDraw({ x: 3, y: 3 }, null);
		editor.handleDrawEnd();

		expect(editor.foregroundColor).toEqual(red);
	});

	it('does not change foregroundColor when picking a transparent pixel', () => {
		const editor = createEditor();
		editor.activeTool = 'eyedropper';
		editor.handleDrawStart();
		editor.handleDraw({ x: 0, y: 0 }, null);
		editor.handleDrawEnd();

		expect(editor.foregroundColor).toEqual(BLACK);
	});

	it('does not push an undo snapshot', () => {
		const editor = createEditor();

		// Paint a pixel first so canUndo becomes true, then undo to reset
		editor.activeTool = 'pencil';
		editor.handleDrawStart();
		editor.handleDraw({ x: 0, y: 0 }, null);
		editor.handleDrawEnd();
		editor.handleUndo();
		expect(editor.canUndo).toBe(false);

		// Use eyedropper — should not create an undo entry
		editor.activeTool = 'eyedropper';
		editor.handleDrawStart();
		editor.handleDraw({ x: 0, y: 0 }, null);
		editor.handleDrawEnd();

		expect(editor.canUndo).toBe(false);
	});

	it('adds picked color to recentColors', () => {
		const editor = createEditor();
		const green = { r: 0, g: 128, b: 0, a: 255 };
		editor.foregroundColor = green;
		editor.activeTool = 'pencil';
		editor.handleDrawStart();
		editor.handleDraw({ x: 2, y: 2 }, null);
		editor.handleDrawEnd();

		editor.recentColors = [];
		editor.foregroundColor = BLACK;
		editor.activeTool = 'eyedropper';
		editor.handleDrawStart();
		editor.handleDraw({ x: 2, y: 2 }, null);
		editor.handleDrawEnd();

		expect(editor.recentColors).toContain('#008000');
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
