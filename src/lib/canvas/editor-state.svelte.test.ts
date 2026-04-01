// @vitest-environment happy-dom
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

describe('EditorState — tool shortcuts', () => {
	it('switches tools via shortcut keys', () => {
		const editor = createEditor();
		const mappings: [string, string][] = [
			['KeyP', 'pencil'],
			['KeyE', 'eraser'],
			['KeyL', 'line'],
			['KeyR', 'rectangle'],
			['KeyC', 'ellipse'],
			['KeyF', 'floodfill'],
			['KeyI', 'eyedropper']
		];
		for (const [code, tool] of mappings) {
			editor.handleKeyDown(keyDown(code));
			expect(editor.activeTool).toBe(tool);
		}
	});

	it('toggles grid with G key', () => {
		const editor = createEditor();
		const initial = editor.viewportState.showGrid;
		editor.handleKeyDown(keyDown('KeyG'));
		expect(editor.viewportState.showGrid).toBe(!initial);
		editor.handleKeyDown(keyDown('KeyG'));
		expect(editor.viewportState.showGrid).toBe(initial);
	});

	it('works regardless of IME input language', () => {
		const editor = createEditor();
		editor.handleKeyDown(keyDown('KeyE', { key: 'ㄷ' }));
		expect(editor.activeTool).toBe('eraser');
	});

	it('ignores shortcuts when Ctrl is held', () => {
		const editor = createEditor();
		editor.activeTool = 'pencil';
		editor.handleKeyDown(keyDown('KeyE', { ctrlKey: true }));
		expect(editor.activeTool).toBe('pencil');
	});

	it('ignores shortcuts when Meta is held', () => {
		const editor = createEditor();
		editor.activeTool = 'pencil';
		editor.handleKeyDown(keyDown('KeyE', { metaKey: true }));
		expect(editor.activeTool).toBe('pencil');
	});

	it('ignores shortcuts when Alt is held', () => {
		const editor = createEditor();
		editor.activeTool = 'pencil';
		editor.handleKeyDown(keyDown('KeyE', { altKey: true }));
		expect(editor.activeTool).toBe('pencil');
	});

	it('ignores shortcuts when Shift is held', () => {
		const editor = createEditor();
		editor.activeTool = 'pencil';
		const initialGrid = editor.viewportState.showGrid;
		editor.handleKeyDown(keyDown('KeyE', { shiftKey: true }));
		editor.handleKeyDown(keyDown('KeyG', { shiftKey: true }));
		expect(editor.activeTool).toBe('pencil');
		expect(editor.viewportState.showGrid).toBe(initialGrid);
	});

	it('ignores tool shortcuts while drawing', () => {
		const editor = createEditor();
		editor.activeTool = 'pencil';
		editor.handleDrawStart();
		editor.handleDraw({ x: 0, y: 0 }, null);
		editor.handleKeyDown(keyDown('KeyE'));
		expect(editor.activeTool).toBe('pencil');
		editor.handleDrawEnd();
	});

	it('allows grid toggle while drawing', () => {
		const editor = createEditor();
		const initial = editor.viewportState.showGrid;
		editor.activeTool = 'pencil';
		editor.handleDrawStart();
		editor.handleDraw({ x: 0, y: 0 }, null);
		editor.handleKeyDown(keyDown('KeyG'));
		expect(editor.viewportState.showGrid).toBe(!initial);
		editor.handleDrawEnd();
	});

	it('ignores G key repeat events', () => {
		const editor = createEditor();
		const initial = editor.viewportState.showGrid;
		editor.handleKeyDown(keyDown('KeyG'));
		expect(editor.viewportState.showGrid).toBe(!initial);
		editor.handleKeyDown(keyDown('KeyG', { repeat: true }));
		expect(editor.viewportState.showGrid).toBe(!initial);
	});
});

describe('EditorState — shortcuts with focused elements', () => {
	it('allows tool shortcuts when a button is focused', () => {
		const editor = createEditor();
		const button = document.createElement('button');
		editor.activeTool = 'pencil';

		editor.handleKeyDown(keyDown('KeyE', { target: button }));
		expect(editor.activeTool).toBe('eraser');
	});

	it('allows undo/redo when a button is focused', () => {
		const editor = createEditor();
		const button = document.createElement('button');
		editor.activeTool = 'pencil';
		editor.handleDrawStart();
		editor.handleDraw({ x: 0, y: 0 }, null);
		editor.handleDrawEnd();

		editor.handleKeyDown(keyDown('KeyZ', { key: 'z', ctrlKey: true, target: button }));
		expect(editor.canRedo).toBe(true);

		editor.handleKeyDown(keyDown('KeyY', { key: 'y', ctrlKey: true, target: button }));
		expect(editor.canRedo).toBe(false);
	});

	it('blocks shortcuts when an input is focused', () => {
		const editor = createEditor();
		const input = document.createElement('input');
		editor.activeTool = 'pencil';

		editor.handleKeyDown(keyDown('KeyE', { target: input }));
		expect(editor.activeTool).toBe('pencil');
	});

	it('blocks shortcuts when a textarea is focused', () => {
		const editor = createEditor();
		const textarea = document.createElement('textarea');
		editor.activeTool = 'pencil';

		editor.handleKeyDown(keyDown('KeyE', { target: textarea }));
		expect(editor.activeTool).toBe('pencil');
	});
});

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
		editor.handleDrawStart();
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
		editor.handleDrawStart();

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
		editor.handleDrawStart();
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

describe('EditorState — Ctrl+Y redo shortcut', () => {
	it('redoes via Ctrl+Y', () => {
		const editor = createEditor();
		drawLine(editor, { x: 0, y: 0 }, { x: 1, y: 0 });
		expect(getPixel(editor, 0, 0)).toEqual(BLACK);

		editor.handleKeyDown(keyDown('KeyZ', { key: 'z', ctrlKey: true }));
		expect(getPixel(editor, 0, 0)).toEqual(TRANSPARENT);

		editor.handleKeyDown(keyDown('KeyY', { key: 'y', ctrlKey: true }));
		expect(getPixel(editor, 0, 0)).toEqual(BLACK);
	});

	it('redoes via Cmd+Y on macOS', () => {
		const editor = createEditor();
		drawLine(editor, { x: 0, y: 0 }, { x: 1, y: 0 });

		editor.handleKeyDown(keyDown('KeyZ', { key: 'z', metaKey: true }));
		expect(getPixel(editor, 0, 0)).toEqual(TRANSPARENT);

		editor.handleKeyDown(keyDown('KeyY', { key: 'y', metaKey: true }));
		expect(getPixel(editor, 0, 0)).toEqual(BLACK);
	});

	it('produces same result as Ctrl+Shift+Z', () => {
		const editorA = createEditor();
		drawLine(editorA, { x: 0, y: 0 }, { x: 1, y: 0 });
		editorA.handleKeyDown(keyDown('KeyZ', { key: 'z', ctrlKey: true }));
		editorA.handleKeyDown(keyDown('KeyY', { key: 'y', ctrlKey: true }));

		const editorB = createEditor();
		drawLine(editorB, { x: 0, y: 0 }, { x: 1, y: 0 });
		editorB.handleKeyDown(keyDown('KeyZ', { key: 'z', ctrlKey: true }));
		editorB.handleKeyDown(keyDown('KeyZ', { key: 'z', ctrlKey: true, shiftKey: true }));

		expect(getPixel(editorA, 0, 0)).toEqual(getPixel(editorB, 0, 0));
		expect(getPixel(editorA, 1, 0)).toEqual(getPixel(editorB, 1, 0));
	});
});

describe('EditorState — X swap colors shortcut', () => {
	it('swaps foreground and background colors via X key', () => {
		const editor = createEditor();
		const initialFg = { ...editor.foregroundColor };
		const initialBg = { ...editor.backgroundColor };

		editor.handleKeyDown(keyDown('KeyX'));
		expect(editor.foregroundColor).toEqual(initialBg);
		expect(editor.backgroundColor).toEqual(initialFg);
	});

	it('ignores repeat events', () => {
		const editor = createEditor();
		const initialFg = { ...editor.foregroundColor };
		const initialBg = { ...editor.backgroundColor };

		editor.handleKeyDown(keyDown('KeyX'));
		expect(editor.foregroundColor).toEqual(initialBg);

		editor.handleKeyDown(keyDown('KeyX', { repeat: true }));
		expect(editor.foregroundColor).toEqual(initialBg);
		expect(editor.backgroundColor).toEqual(initialFg);
	});

	it('works during drawing', () => {
		const editor = createEditor();
		editor.activeTool = 'pencil';
		editor.handleDrawStart();
		editor.handleDraw({ x: 0, y: 0 }, null);

		const fgBefore = { ...editor.foregroundColor };
		const bgBefore = { ...editor.backgroundColor };

		editor.handleKeyDown(keyDown('KeyX'));
		expect(editor.foregroundColor).toEqual(bgBefore);
		expect(editor.backgroundColor).toEqual(fgBefore);

		editor.handleDrawEnd();
	});
});

describe('EditorState — Space pan mode', () => {
	it('sets isSpaceHeld to true on Space press', () => {
		const editor = createEditor();
		expect(editor.isSpaceHeld).toBe(false);

		editor.handleKeyDown(keyDown('Space'));
		expect(editor.isSpaceHeld).toBe(true);
	});

	it('resets isSpaceHeld to false on Space release', () => {
		const editor = createEditor();
		editor.handleKeyDown(keyDown('Space'));
		expect(editor.isSpaceHeld).toBe(true);

		editor.handleKeyUp(keyUp('Space'));
		expect(editor.isSpaceHeld).toBe(false);
	});

	it('ignores Space repeat events', () => {
		const editor = createEditor();
		editor.handleKeyDown(keyDown('Space'));
		expect(editor.isSpaceHeld).toBe(true);

		// Release to reset, then verify repeat doesn't re-enable
		editor.handleKeyUp(keyUp('Space'));
		expect(editor.isSpaceHeld).toBe(false);

		// First press enables
		editor.handleKeyDown(keyDown('Space'));
		expect(editor.isSpaceHeld).toBe(true);

		// Repeat should not cause issues (still true)
		editor.handleKeyDown(keyDown('Space', { repeat: true }));
		expect(editor.isSpaceHeld).toBe(true);
	});

	it('ignores Space when drawing', () => {
		const editor = createEditor();
		editor.activeTool = 'pencil';
		editor.handleDrawStart();
		editor.handleDraw({ x: 0, y: 0 }, null);

		editor.handleKeyDown(keyDown('Space'));
		expect(editor.isSpaceHeld).toBe(false);

		editor.handleDrawEnd();
	});

	it('resets isSpaceHeld on window blur', () => {
		const editor = createEditor();
		editor.handleKeyDown(keyDown('Space'));
		expect(editor.isSpaceHeld).toBe(true);

		editor.handleBlur();
		expect(editor.isSpaceHeld).toBe(false);
	});

	it('allows tool shortcuts after Space release', () => {
		const editor = createEditor();
		editor.activeTool = 'pencil';

		editor.handleKeyDown(keyDown('Space'));
		expect(editor.isSpaceHeld).toBe(true);

		editor.handleKeyUp(keyUp('Space'));
		expect(editor.isSpaceHeld).toBe(false);

		editor.handleKeyDown(keyDown('KeyE'));
		expect(editor.activeTool).toBe('eraser');
	});
});

describe('EditorState — Shift constrain', () => {
	it('constrains line to horizontal when Shift is held', () => {
		const editor = createEditor();
		editor.activeTool = 'line';

		editor.handleKeyDown(keyDown('ShiftLeft'));
		editor.handleDrawStart();
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
		editor.handleDrawStart();
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
		editor.handleDrawStart();
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
		editor.handleDrawStart();
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
		editor.handleDrawStart();
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
		editor.handleDrawStart();
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
		editor.handleDrawStart();
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
		editor.handleDrawStart();
		editor.handleDraw({ x: 3, y: 3 }, null);
		editor.handleDrawEnd();
		expect(getPixel(editor, 3, 3)).toEqual(BLACK);

		// Erase with Shift held
		editor.activeTool = 'eraser';
		editor.handleKeyDown(keyDown('ShiftLeft'));
		editor.handleDrawStart();
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

describe('EditorState — shortcut hints (/ key)', () => {
	it('sets shortcutHintsVisible to true on / press', () => {
		const editor = createEditor();
		expect(editor.shortcutHintsVisible).toBe(false);

		editor.handleKeyDown(keyDown('Slash'));
		expect(editor.shortcutHintsVisible).toBe(true);
	});

	it('resets shortcutHintsVisible to false on / release', () => {
		const editor = createEditor();
		editor.handleKeyDown(keyDown('Slash'));
		expect(editor.shortcutHintsVisible).toBe(true);

		editor.handleKeyUp(keyUp('Slash'));
		expect(editor.shortcutHintsVisible).toBe(false);
	});

	it('ignores / repeat events', () => {
		const editor = createEditor();
		editor.handleKeyDown(keyDown('Slash'));
		expect(editor.shortcutHintsVisible).toBe(true);

		// Repeat should not cause issues
		editor.handleKeyDown(keyDown('Slash', { repeat: true }));
		expect(editor.shortcutHintsVisible).toBe(true);
	});

	it('does not show hints while drawing', () => {
		const editor = createEditor();
		editor.activeTool = 'pencil';
		editor.handleDrawStart();
		editor.handleDraw({ x: 0, y: 0 }, null);

		editor.handleKeyDown(keyDown('Slash'));
		expect(editor.shortcutHintsVisible).toBe(false);

		editor.handleDrawEnd();
	});

	it('blocks drawing while hints are visible', () => {
		const editor = createEditor();
		editor.handleKeyDown(keyDown('Slash'));
		expect(editor.shortcutHintsVisible).toBe(true);

		// Attempt to draw — should be blocked
		editor.handleDrawStart();
		editor.handleDraw({ x: 0, y: 0 }, null);
		editor.handleDrawEnd();

		// Pixel should remain transparent (no drawing occurred)
		expect(getPixel(editor, 0, 0)).toEqual(TRANSPARENT);
	});

	it('resets shortcutHintsVisible on window blur', () => {
		const editor = createEditor();
		editor.handleKeyDown(keyDown('Slash'));
		expect(editor.shortcutHintsVisible).toBe(true);

		editor.handleBlur();
		expect(editor.shortcutHintsVisible).toBe(false);
	});
});
