// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { EditorController } from './editor-controller.svelte';
import { createEditorController, type CreateEditorControllerOptions } from './create-editor-controller';
import { wasmBackend } from '../wasm-backend';
import { createFakeDirtyNotifier } from './fake-dirty-notifier';
import type { Color } from '../color';
import type { CanvasCoords } from '../canvas-model';

const BLACK: Color = { r: 0, g: 0, b: 0, a: 255 };
const WHITE: Color = { r: 255, g: 255, b: 255, a: 255 };
const RED: Color = { r: 255, g: 0, b: 0, a: 255 };

function makeController(overrides: Partial<CreateEditorControllerOptions> = {}) {
	const notifier = createFakeDirtyNotifier();
	const editor = createEditorController({
		backend: wasmBackend,
		notifier,
		...overrides
	});
	return { editor, notifier };
}

function drawLine(editor: EditorController, from: CanvasCoords, to: CanvasCoords) {
	editor.setTool('line');
	editor.handleDrawStart(0, 'mouse');
	editor.handleDraw(from, null);
	editor.handleDraw(to, from);
	editor.handleDrawEnd();
}

describe('EditorController — construction & escape hatches', () => {
	it('createEditorController returns a fully wired controller', () => {
		const { editor } = makeController();
		expect(editor).toBeInstanceOf(EditorController);
		expect(editor.workspace).toBeDefined();
		expect(editor.keyboard).toBeDefined();
	});

	it('initial workspace has a single tab', () => {
		const { editor } = makeController();
		expect(editor.workspace.tabs).toHaveLength(1);
		expect(editor.workspace.activeIndex).toBe(0);
	});

	it('initialForegroundColor flows through to shared state', () => {
		const { editor } = makeController({ initialForegroundColor: RED });
		expect(editor.foregroundColor).toEqual(RED);
	});

	it('gridColor flows through to the initial tab', () => {
		const { editor } = makeController({ gridColor: '#ECE5D9' });
		expect(editor.viewport.gridColor).toBe('#ECE5D9');
	});

	it('editor.workspace and editor.keyboard are the injected instances', () => {
		const { editor } = makeController();
		const ws = editor.workspace;
		const kb = editor.keyboard;
		const controller = new EditorController(ws, kb);
		expect(controller.workspace).toBe(ws);
		expect(controller.keyboard).toBe(kb);
	});
});

describe('EditorController — shared-state projections', () => {
	it('activeTool projects workspace.shared.activeTool', () => {
		const { editor } = makeController();
		editor.workspace.shared.activeTool = 'eraser';
		expect(editor.activeTool).toBe('eraser');
	});

	it('foregroundColor and backgroundColor project shared state', () => {
		const { editor } = makeController();
		editor.workspace.shared.foregroundColor = RED;
		editor.workspace.shared.backgroundColor = WHITE;
		expect(editor.foregroundColor).toEqual(RED);
		expect(editor.backgroundColor).toEqual(WHITE);
	});

	it('foregroundColorHex and backgroundColorHex derive from Color projections', () => {
		const { editor } = makeController();
		editor.workspace.shared.foregroundColor = RED;
		editor.workspace.shared.backgroundColor = BLACK;
		expect(editor.foregroundColorHex).toBe('#ff0000');
		expect(editor.backgroundColorHex).toBe('#000000');
	});

	it('recentColors projects workspace.shared.recentColors', () => {
		const { editor } = makeController();
		editor.workspace.shared.recentColors = ['#aabbcc', '#ddeeff'];
		expect(editor.recentColors).toEqual(['#aabbcc', '#ddeeff']);
	});

	it('pixelPerfect projects workspace.shared.pixelPerfect', () => {
		const { editor } = makeController();
		editor.workspace.shared.pixelPerfect = false;
		expect(editor.pixelPerfect).toBe(false);
	});

	it('toolCursor derives from the active tool', () => {
		const { editor } = makeController();
		editor.workspace.shared.activeTool = 'eraser';
		expect(editor.toolCursor).toBeDefined();
		expect(typeof editor.toolCursor).toBe('string');
	});
});

describe('EditorController — active-tab projections', () => {
	it('pixelCanvas, viewport, viewportSize reflect the active tab', () => {
		const { editor } = makeController();
		expect(editor.pixelCanvas).toBe(editor.workspace.activeTab.pixelCanvas);
		expect(editor.viewport).toBe(editor.workspace.activeTab.viewport);
		expect(editor.viewportSize).toBe(editor.workspace.activeTab.viewportSize);
	});

	it('renderVersion projects the active tab', () => {
		const { editor } = makeController();
		const before = editor.renderVersion;
		drawLine(editor, { x: 0, y: 0 }, { x: 3, y: 0 });
		expect(editor.renderVersion).toBeGreaterThan(before);
	});

	it('resizeAnchor projects the active tab', () => {
		const { editor } = makeController();
		editor.workspace.activeTab.resizeAnchor = 'bottom-right';
		expect(editor.resizeAnchor).toBe('bottom-right');
	});

	it('isExportUIOpen projects the active tab', () => {
		const { editor } = makeController();
		expect(editor.isExportUIOpen).toBe(false);
		editor.toggleExportUI();
		expect(editor.isExportUIOpen).toBe(true);
	});

	it('samplingSession projects the active tab', () => {
		const { editor } = makeController();
		expect(editor.samplingSession).toBe(editor.workspace.activeTab.samplingSession);
	});

	it('canUndo and canRedo project the active tab', () => {
		const { editor } = makeController();
		expect(editor.canUndo).toBe(false);
		expect(editor.canRedo).toBe(false);
		drawLine(editor, { x: 0, y: 0 }, { x: 3, y: 0 });
		expect(editor.canUndo).toBe(true);
		editor.handleUndo();
		expect(editor.canRedo).toBe(true);
	});

	it('zoomPercent projects the active tab zoom', () => {
		const { editor } = makeController();
		expect(editor.zoomPercent).toBe(Math.round(editor.viewport.zoom * 100));
	});

	it('switching tabs switches the active-tab projections', () => {
		const { editor } = makeController();
		editor.workspace.addTab();
		drawLine(editor, { x: 0, y: 0 }, { x: 3, y: 0 });
		const secondTabCanvas = editor.pixelCanvas;

		editor.workspace.setActiveTab(0);
		expect(editor.pixelCanvas).not.toBe(secondTabCanvas);
		expect(editor.canUndo).toBe(false);
	});
});

describe('EditorController — keyboard projections', () => {
	it('isSpaceHeld, isShiftHeld, isShortcutHintsVisible default to false', () => {
		const { editor } = makeController();
		expect(editor.isSpaceHeld).toBe(false);
		expect(editor.isShiftHeld).toBe(false);
		expect(editor.isShortcutHintsVisible).toBe(false);
	});

	it('isSpaceHeld reflects keyboard after Space press', () => {
		const { editor } = makeController();
		editor.handleKeyDown(new KeyboardEvent('keydown', { code: 'Space' }));
		expect(editor.isSpaceHeld).toBe(true);
		editor.handleKeyUp(new KeyboardEvent('keyup', { code: 'Space' }));
		expect(editor.isSpaceHeld).toBe(false);
	});

	it('isShiftHeld reflects keyboard after Shift press', () => {
		const { editor } = makeController();
		editor.handleKeyDown(new KeyboardEvent('keydown', { code: 'ShiftLeft' }));
		expect(editor.isShiftHeld).toBe(true);
		editor.handleKeyUp(new KeyboardEvent('keyup', { code: 'ShiftLeft' }));
		expect(editor.isShiftHeld).toBe(false);
	});
});

describe('EditorController — setter methods', () => {
	it('setTool routes through workspace and triggers markDirty', () => {
		const { editor, notifier } = makeController();
		notifier.reset();

		editor.setTool('line');

		expect(editor.workspace.shared.activeTool).toBe('line');
		expect(notifier.dirtyCalls).toEqual([editor.workspace.activeTab.documentId]);
	});

	it('setForegroundColor routes through workspace and triggers markDirty', () => {
		const { editor, notifier } = makeController();
		notifier.reset();

		editor.setForegroundColor(RED);

		expect(editor.workspace.shared.foregroundColor).toEqual(RED);
		expect(notifier.dirtyCalls).toEqual([editor.workspace.activeTab.documentId]);
	});

	it('setBackgroundColor routes through workspace and triggers markDirty', () => {
		const { editor, notifier } = makeController();
		notifier.reset();

		editor.setBackgroundColor(RED);

		expect(editor.workspace.shared.backgroundColor).toEqual(RED);
		expect(notifier.dirtyCalls).toEqual([editor.workspace.activeTab.documentId]);
	});

	it('togglePixelPerfect routes through workspace and triggers markDirty', () => {
		const { editor, notifier } = makeController();
		const initial = editor.pixelPerfect;
		notifier.reset();

		editor.togglePixelPerfect();

		expect(editor.pixelPerfect).toBe(!initial);
		expect(notifier.dirtyCalls).toEqual([editor.workspace.activeTab.documentId]);
	});
});

describe('EditorController — handler delegation', () => {
	it('handleUndo delegates to activeTab.undo', () => {
		const { editor } = makeController();
		drawLine(editor, { x: 0, y: 0 }, { x: 3, y: 0 });
		expect(editor.canUndo).toBe(true);

		editor.handleUndo();

		expect(editor.canUndo).toBe(false);
		expect(editor.canRedo).toBe(true);
	});

	it('handleRedo delegates to activeTab.redo', () => {
		const { editor } = makeController();
		drawLine(editor, { x: 0, y: 0 }, { x: 3, y: 0 });
		const afterDraw = editor.pixelCanvas.pixels();
		editor.handleUndo();

		editor.handleRedo();

		expect(editor.pixelCanvas.pixels()).toEqual(afterDraw);
	});

	it('handleDrawStart/Draw/End route through activeTab', () => {
		const { editor } = makeController();
		editor.setTool('pencil');
		editor.handleDrawStart(0, 'mouse');
		editor.handleDraw({ x: 1, y: 1 }, null);
		editor.handleDrawEnd();
		expect(editor.canUndo).toBe(true);
	});

	it('handleDrawStart is suppressed while shortcut hints are visible', () => {
		const { editor } = makeController();
		editor.handleKeyDown(new KeyboardEvent('keydown', { code: 'Slash' }));
		expect(editor.isShortcutHintsVisible).toBe(true);

		editor.setTool('pencil');
		editor.handleDrawStart(0, 'mouse');
		editor.handleDraw({ x: 1, y: 1 }, null);
		editor.handleDrawEnd();

		expect(editor.canUndo).toBe(false);
	});

	it('handleSampleStart delegates to activeTab.sampleStart', () => {
		const { editor } = makeController();
		editor.setTool('pencil');
		editor.handleDrawStart(0, 'mouse');
		editor.handleDraw({ x: 3, y: 3 }, null);
		editor.handleDrawEnd();

		editor.setForegroundColor(BLACK);
		const started = editor.handleSampleStart({ x: 3, y: 3 }, 0, 'mouse');
		editor.handleSampleUpdate({ x: 3, y: 3 });
		editor.handleSampleEnd();

		expect(started).toBe(true);
	});

	it('handleSampleStart returns false when activeTool is eyedropper', () => {
		const { editor } = makeController();
		editor.setTool('eyedropper');
		expect(editor.handleSampleStart({ x: 0, y: 0 }, 0, 'mouse')).toBe(false);
	});

	it('handleResize delegates to activeTab.resize', () => {
		const { editor } = makeController();
		editor.handleResize(32, 24);
		expect(editor.pixelCanvas.width).toBe(32);
		expect(editor.pixelCanvas.height).toBe(24);
	});

	it('handleGridToggle delegates to activeTab.toggleGrid', () => {
		const { editor } = makeController();
		const initial = editor.viewport.showGrid;
		editor.handleGridToggle();
		expect(editor.viewport.showGrid).toBe(!initial);
	});

	it('handleForegroundColorChange converts hex and routes through setForegroundColor', () => {
		const { editor, notifier } = makeController();
		notifier.reset();

		editor.handleForegroundColorChange('#ff0000');

		expect(editor.foregroundColor).toEqual(RED);
		expect(notifier.dirtyCalls).toEqual([editor.workspace.activeTab.documentId]);
	});

	it('handleBackgroundColorChange converts hex and routes through setBackgroundColor', () => {
		const { editor, notifier } = makeController();
		notifier.reset();

		editor.handleBackgroundColorChange('#ff0000');

		expect(editor.backgroundColor).toEqual(RED);
		expect(notifier.dirtyCalls).toEqual([editor.workspace.activeTab.documentId]);
	});

	it('swapColors delegates to workspace.swapColors', () => {
		const { editor } = makeController();
		editor.setForegroundColor(RED);
		editor.setBackgroundColor(WHITE);

		editor.swapColors();

		expect(editor.foregroundColor).toEqual(WHITE);
		expect(editor.backgroundColor).toEqual(RED);
	});

	it('toggleExportUI delegates to activeTab.toggleExportUI', () => {
		const { editor } = makeController();
		editor.toggleExportUI();
		expect(editor.isExportUIOpen).toBe(true);
	});

	it('handleZoomIn/Out/Reset/Fit route through activeTab viewport ops', () => {
		const { editor } = makeController();
		const originalZoom = editor.viewport.zoom;

		editor.handleZoomIn();
		expect(editor.viewport.zoom).toBeGreaterThan(originalZoom);

		editor.handleZoomReset();
		expect(editor.viewport.zoom).toBe(1);

		editor.handleZoomOut();
		expect(editor.viewport.zoom).toBeLessThanOrEqual(1);

		editor.handleFit();
		expect(editor.viewport.zoom).toBeGreaterThan(0);
	});
});

describe('EditorController — keyboard integration (circular closure)', () => {
	it('Alt press routes through keyboard host to workspace.setActiveTool', () => {
		const { editor } = makeController();
		editor.setTool('pencil');

		editor.handleKeyDown(new KeyboardEvent('keydown', { code: 'AltLeft' }));

		expect(editor.activeTool).toBe('eyedropper');
	});

	it('Undo shortcut (Cmd+Z) routes through keyboard to activeTab.undo', () => {
		const { editor } = makeController();
		drawLine(editor, { x: 0, y: 0 }, { x: 3, y: 0 });
		expect(editor.canUndo).toBe(true);

		editor.handleKeyDown(new KeyboardEvent('keydown', { code: 'KeyZ', key: 'z', metaKey: true }));

		expect(editor.canUndo).toBe(false);
	});

	it('Shift held during stroke notifies modifier change on activeTab', () => {
		const { editor } = makeController();
		editor.setTool('line');
		editor.handleDrawStart(0, 'mouse');
		editor.handleDraw({ x: 0, y: 0 }, null);
		editor.handleDraw({ x: 3, y: 2 }, { x: 0, y: 0 });

		// Shift press during stroke should not throw (workspace.activeTab.modifierChanged fires)
		expect(() =>
			editor.handleKeyDown(new KeyboardEvent('keydown', { code: 'ShiftLeft' }))
		).not.toThrow();

		editor.handleDrawEnd();
	});

	it('handleDrawEnd consumes pending tool restore (Alt → eyedropper → release)', () => {
		const { editor } = makeController();
		editor.setTool('pencil');

		editor.handleKeyDown(new KeyboardEvent('keydown', { code: 'AltLeft' }));
		expect(editor.activeTool).toBe('eyedropper');

		editor.handleDrawStart(0, 'mouse');
		editor.handleDraw({ x: 0, y: 0 }, null);
		editor.handleKeyUp(new KeyboardEvent('keyup', { code: 'AltLeft' }));
		editor.handleDrawEnd();

		expect(editor.activeTool).toBe('pencil');
	});
});
