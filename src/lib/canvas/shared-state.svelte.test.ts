// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { SharedState } from './shared-state.svelte';
import { EditorState } from './editor-state.svelte';

describe('SharedState', () => {
	it('has correct default values', () => {
		const shared = new SharedState();

		expect(shared.activeTool).toBe('pencil');
		expect(shared.foregroundColor).toEqual({ r: 0, g: 0, b: 0, a: 255 });
		expect(shared.backgroundColor).toEqual({ r: 255, g: 255, b: 255, a: 255 });
		expect(shared.recentColors).toEqual([]);
		expect(shared.pixelPerfect).toBe(true);
	});
});

describe('EditorState — SharedState integration', () => {
	it('creates a default SharedState when none is provided', () => {
		const editor = new EditorState({ canvasWidth: 8, canvasHeight: 8 });

		expect(editor.shared).toBeDefined();
		expect(editor.shared.activeTool).toBe('pencil');
		expect(editor.shared.foregroundColor).toEqual({ r: 0, g: 0, b: 0, a: 255 });
		expect(editor.shared.backgroundColor).toEqual({ r: 255, g: 255, b: 255, a: 255 });
		expect(editor.shared.recentColors).toEqual([]);
	});

	it('delegates activeTool through shared state', () => {
		const shared = new SharedState();
		const editor = new EditorState({ canvasWidth: 8, canvasHeight: 8, shared });

		editor.activeTool = 'eraser';
		expect(shared.activeTool).toBe('eraser');

		shared.activeTool = 'line';
		expect(editor.activeTool).toBe('line');
	});

	it('delegates foregroundColor through shared state', () => {
		const shared = new SharedState();
		const editor = new EditorState({ canvasWidth: 8, canvasHeight: 8, shared });
		const red = { r: 255, g: 0, b: 0, a: 255 };

		editor.foregroundColor = red;
		expect(shared.foregroundColor).toEqual(red);

		const blue = { r: 0, g: 0, b: 255, a: 255 };
		shared.foregroundColor = blue;
		expect(editor.foregroundColor).toEqual(blue);
	});

	it('delegates backgroundColor through shared state', () => {
		const shared = new SharedState();
		const editor = new EditorState({ canvasWidth: 8, canvasHeight: 8, shared });
		const green = { r: 0, g: 255, b: 0, a: 255 };

		editor.backgroundColor = green;
		expect(shared.backgroundColor).toEqual(green);
	});

	it('delegates recentColors through shared state', () => {
		const shared = new SharedState();
		const editor = new EditorState({ canvasWidth: 8, canvasHeight: 8, shared });

		editor.recentColors = ['#ff0000', '#00ff00'];
		expect(shared.recentColors).toEqual(['#ff0000', '#00ff00']);

		shared.recentColors = ['#0000ff'];
		expect(editor.recentColors).toEqual(['#0000ff']);
	});

	it('two editors sharing SharedState see the same activeTool', () => {
		const shared = new SharedState();
		const editorA = new EditorState({ canvasWidth: 8, canvasHeight: 8, shared });
		const editorB = new EditorState({ canvasWidth: 8, canvasHeight: 8, shared });

		editorA.activeTool = 'eraser';
		expect(editorB.activeTool).toBe('eraser');

		editorB.activeTool = 'floodfill';
		expect(editorA.activeTool).toBe('floodfill');
	});

	it('two editors sharing SharedState see the same colors', () => {
		const shared = new SharedState();
		const editorA = new EditorState({ canvasWidth: 8, canvasHeight: 8, shared });
		const editorB = new EditorState({ canvasWidth: 8, canvasHeight: 8, shared });
		const red = { r: 255, g: 0, b: 0, a: 255 };

		editorA.foregroundColor = red;
		expect(editorB.foregroundColor).toEqual(red);

		const green = { r: 0, g: 255, b: 0, a: 255 };
		editorB.backgroundColor = green;
		expect(editorA.backgroundColor).toEqual(green);
	});

	it('two editors sharing SharedState see the same recentColors', () => {
		const shared = new SharedState();
		const editorA = new EditorState({ canvasWidth: 8, canvasHeight: 8, shared });
		const editorB = new EditorState({ canvasWidth: 8, canvasHeight: 8, shared });

		editorA.recentColors = ['#ff0000'];
		expect(editorB.recentColors).toEqual(['#ff0000']);
	});

	it('independent state does not leak between editors sharing SharedState', () => {
		const shared = new SharedState();
		const editorA = new EditorState({ canvasWidth: 8, canvasHeight: 8, shared });
		const editorB = new EditorState({ canvasWidth: 4, canvasHeight: 4, shared });

		expect(editorA.pixelCanvas.width).toBe(8);
		expect(editorB.pixelCanvas.width).toBe(4);

		editorA.resizeAnchor = 'center';
		expect(editorB.resizeAnchor).toBe('top-left');

		editorA.renderVersion++;
		expect(editorA.renderVersion).toBe(1);
		expect(editorB.renderVersion).toBe(0);
	});
});
