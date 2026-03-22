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
const TRANSPARENT = { r: 0, g: 0, b: 0, a: 0 };

function drawLine(editor: EditorState, from: CanvasCoords, to: CanvasCoords) {
	editor.activeTool = 'line';
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
