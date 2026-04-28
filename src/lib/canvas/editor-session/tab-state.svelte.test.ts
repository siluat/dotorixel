// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { TabState, type TabStateDeps } from './tab-state.svelte';
import { wasmBackend } from '../wasm-backend';
import { createFakeDirtyNotifier } from './fake-dirty-notifier';
import { SharedState } from '../shared-state.svelte';
import type { CanvasCoords } from '../canvas-model';
import type { Color } from '../color';
import { samplePixel as samplerSamplePixel } from '../../reference-images/sampler';

vi.mock('../../reference-images/sampler', () => ({
	samplePixel: vi.fn()
}));

const mockedSamplePixel = vi.mocked(samplerSamplePixel);

const BLACK: Color = { r: 0, g: 0, b: 0, a: 255 };
const WHITE: Color = { r: 255, g: 255, b: 255, a: 255 };

function makeTab(overrides: Omit<Partial<TabStateDeps>, 'notifier'> = {}) {
	const shared = overrides.shared ?? new SharedState();
	const notifier = createFakeDirtyNotifier();
	const tab = new TabState({
		backend: wasmBackend,
		shared,
		keyboard: { getShiftHeld: () => false },
		notifier,
		documentId: 'doc-test',
		name: 'Untitled 1',
		canvasWidth: 8,
		canvasHeight: 8,
		...overrides
	});
	return { tab, shared, notifier };
}

function drawLine(tab: TabState, from: CanvasCoords, to: CanvasCoords) {
	tab.shared.activeTool = 'line';
	tab.drawStart(0, 'mouse');
	tab.draw(from, null);
	tab.draw(to, from);
	tab.drawEnd();
}

function getPixel(tab: TabState, x: number, y: number): Color {
	const p = tab.pixelCanvas.get_pixel(x, y);
	return { r: p.r, g: p.g, b: p.b, a: p.a };
}

describe('TabState — ownership', () => {
	it('owns its own pixelCanvas and viewport; two tabs do not share them', () => {
		const { tab: a } = makeTab({ documentId: 'a' });
		const { tab: b } = makeTab({ documentId: 'b' });
		expect(a.pixelCanvas).not.toBe(b.pixelCanvas);
		expect(a.viewport).not.toBe(b.viewport);
	});

	it('holds a reference to the injected SharedState; tabs see the same shared', () => {
		const shared = new SharedState();
		const { tab: a } = makeTab({ shared, documentId: 'a' });
		const { tab: b } = makeTab({ shared, documentId: 'b' });
		expect(a.shared).toBe(shared);
		expect(b.shared).toBe(shared);

		shared.foregroundColor = { r: 10, g: 20, b: 30, a: 255 };
		expect(a.shared.foregroundColor).toEqual({ r: 10, g: 20, b: 30, a: 255 });
		expect(b.shared.foregroundColor).toEqual({ r: 10, g: 20, b: 30, a: 255 });
	});
});

describe('TabState — effect dispatcher', () => {
	it('canvasChanged bumps renderVersion and marks dirty', () => {
		const { tab, notifier } = makeTab();
		const before = tab.renderVersion;

		drawLine(tab, { x: 0, y: 0 }, { x: 3, y: 0 });

		expect(tab.renderVersion).toBeGreaterThan(before);
		expect(notifier.dirtyCalls.length).toBeGreaterThan(0);
		expect(notifier.dirtyCalls.every((id) => id === 'doc-test')).toBe(true);
	});

	it('canvasReplaced path: undo after resize swaps the canvas and bumps renderVersion', () => {
		const { tab } = makeTab({ canvasWidth: 8, canvasHeight: 8 });
		expect(tab.pixelCanvas.width).toBe(8);

		tab.resize(16, 16);
		expect(tab.pixelCanvas.width).toBe(16);
		expect(tab.pixelCanvas.height).toBe(16);

		const beforeUndo = tab.renderVersion;
		tab.undo();

		expect(tab.pixelCanvas.width).toBe(8);
		expect(tab.pixelCanvas.height).toBe(8);
		expect(tab.renderVersion).toBeGreaterThan(beforeUndo);
	});

	it('colorPick + addRecentColor: sampling an opaque pixel updates shared.foregroundColor and shared.recentColors', () => {
		const { tab, notifier, shared } = makeTab();

		shared.foregroundColor = WHITE;
		shared.activeTool = 'pencil';
		tab.drawStart(0, 'mouse');
		tab.draw({ x: 3, y: 3 }, null);
		tab.drawEnd();

		shared.foregroundColor = BLACK;
		shared.recentColors = [];
		notifier.reset();

		const started = tab.sampleStart({ x: 3, y: 3 }, 0, 'mouse');
		expect(started).toBe(true);
		tab.sampleUpdate({ x: 3, y: 3 });
		tab.sampleEnd();

		expect(shared.foregroundColor).toEqual(WHITE);
		expect(shared.recentColors.length).toBeGreaterThan(0);
		expect(notifier.dirtyCalls).toEqual(['doc-test']);
	});
});

describe('TabState — auto-dirty emission', () => {
	it('drawStart/draw/drawEnd cycle emits markDirty at least once', () => {
		const { tab, notifier } = makeTab();
		drawLine(tab, { x: 0, y: 0 }, { x: 3, y: 0 });
		expect(notifier.dirtyCalls.length).toBeGreaterThan(0);
	});

	it('resize emits markDirty with this tab documentId', () => {
		const { tab, notifier } = makeTab({ documentId: 'doc-resize' });
		notifier.reset();
		tab.resize(16, 16);
		expect(notifier.dirtyCalls).toContain('doc-resize');
	});

	it('setViewport emits markDirty', () => {
		const { tab, notifier } = makeTab();
		notifier.reset();
		tab.setViewport({ ...tab.viewport, zoom: 2 });
		expect(notifier.dirtyCalls).toEqual(['doc-test']);
	});

	it('toggleGrid emits markDirty', () => {
		const { tab, notifier } = makeTab();
		notifier.reset();
		tab.toggleGrid();
		expect(notifier.dirtyCalls).toEqual(['doc-test']);
	});

	it('toggleExportUI does NOT emit markDirty', () => {
		const { tab, notifier } = makeTab();
		notifier.reset();
		tab.toggleExportUI();
		tab.toggleExportUI();
		expect(notifier.dirtyCalls).toEqual([]);
	});

	it('sampleStart/update without a committed commit does NOT emit markDirty', () => {
		const { tab, notifier } = makeTab();
		notifier.reset();
		tab.sampleStart({ x: 0, y: 0 }, 0, 'mouse');
		tab.sampleUpdate({ x: 1, y: 1 });
		expect(notifier.dirtyCalls).toEqual([]);
	});
});

describe('TabState — sample gating', () => {
	it('sampleStart returns false when activeTool is eyedropper', () => {
		const { tab, shared } = makeTab();
		shared.activeTool = 'eyedropper';
		expect(tab.sampleStart({ x: 0, y: 0 }, 0, 'mouse')).toBe(false);
	});
});

describe('TabState — reference image sampling', () => {
	const blob = new Blob([new Uint8Array([0])], { type: 'image/png' });

	it('opaque sample updates foregroundColor + recentColors and emits markDirty', async () => {
		mockedSamplePixel.mockResolvedValueOnce({ r: 12, g: 34, b: 56, a: 255 });
		const { tab, shared, notifier } = makeTab({ documentId: 'doc-ref' });
		shared.foregroundColor = BLACK;
		shared.recentColors = [];
		notifier.reset();

		await tab.sampleReferenceCommit(blob, 0, 0);

		expect(shared.foregroundColor).toEqual({ r: 12, g: 34, b: 56, a: 255 });
		expect(shared.recentColors).toEqual(['#0c2238']);
		expect(notifier.dirtyCalls).toEqual(['doc-ref']);
	});

	it('decode failure is silent: no effects, foregroundColor unchanged, no markDirty', async () => {
		mockedSamplePixel.mockRejectedValueOnce(new Error('decode failed'));
		const { tab, shared, notifier } = makeTab({ documentId: 'doc-ref' });
		shared.foregroundColor = BLACK;
		shared.recentColors = [];
		notifier.reset();

		await expect(tab.sampleReferenceCommit(blob, 0, 0)).resolves.toBeUndefined();

		expect(shared.foregroundColor).toEqual(BLACK);
		expect(shared.recentColors).toEqual([]);
		expect(notifier.dirtyCalls).toEqual([]);
	});

	it('transparent sample (a===0) emits no effects, leaves foregroundColor unchanged', async () => {
		mockedSamplePixel.mockResolvedValueOnce({ r: 0, g: 0, b: 0, a: 0 });
		const { tab, shared, notifier } = makeTab({ documentId: 'doc-ref' });
		shared.foregroundColor = BLACK;
		shared.recentColors = [];
		notifier.reset();

		await tab.sampleReferenceCommit(blob, 0, 0);

		expect(shared.foregroundColor).toEqual(BLACK);
		expect(shared.recentColors).toEqual([]);
		expect(notifier.dirtyCalls).toEqual([]);
	});

	it('preview updates foregroundColor but does not append to recentColors', async () => {
		mockedSamplePixel.mockResolvedValueOnce({ r: 12, g: 34, b: 56, a: 255 });
		const { tab, shared, notifier } = makeTab({ documentId: 'doc-ref' });
		shared.foregroundColor = BLACK;
		shared.recentColors = [];
		notifier.reset();

		await tab.sampleReferencePreview(blob, 0, 0);

		expect(shared.foregroundColor).toEqual({ r: 12, g: 34, b: 56, a: 255 });
		expect(shared.recentColors).toEqual([]);
		expect(notifier.dirtyCalls).toEqual(['doc-ref']);
	});

	it('preview ignores transparent samples — no effects, foregroundColor unchanged', async () => {
		mockedSamplePixel.mockResolvedValueOnce({ r: 0, g: 0, b: 0, a: 0 });
		const { tab, shared, notifier } = makeTab({ documentId: 'doc-ref' });
		shared.foregroundColor = BLACK;
		shared.recentColors = [];
		notifier.reset();

		await tab.sampleReferencePreview(blob, 0, 0);

		expect(shared.foregroundColor).toEqual(BLACK);
		expect(notifier.dirtyCalls).toEqual([]);
	});

	it('preview swallows decode failures silently', async () => {
		mockedSamplePixel.mockRejectedValueOnce(new Error('decode failed'));
		const { tab, shared, notifier } = makeTab({ documentId: 'doc-ref' });
		shared.foregroundColor = BLACK;
		notifier.reset();

		await expect(tab.sampleReferencePreview(blob, 0, 0)).resolves.toBeUndefined();

		expect(shared.foregroundColor).toEqual(BLACK);
		expect(notifier.dirtyCalls).toEqual([]);
	});

	it('stale preview from a slow decode is dropped when a newer call has already started', async () => {
		// Slow first call (will resolve last), fast second call (resolves first).
		let resolveSlow!: (color: { r: number; g: number; b: number; a: number }) => void;
		mockedSamplePixel.mockImplementationOnce(
			() => new Promise((r) => { resolveSlow = r; })
		);
		mockedSamplePixel.mockResolvedValueOnce({ r: 200, g: 200, b: 200, a: 255 });

		const { tab, shared } = makeTab({ documentId: 'doc-ref' });
		shared.foregroundColor = BLACK;

		const slow = tab.sampleReferencePreview(blob, 0, 0);
		const fast = tab.sampleReferencePreview(blob, 1, 1);

		await fast;
		expect(shared.foregroundColor).toEqual({ r: 200, g: 200, b: 200, a: 255 });

		// Now the slow call resolves with a different color — it should be ignored.
		resolveSlow({ r: 50, g: 50, b: 50, a: 255 });
		await slow;

		expect(shared.foregroundColor).toEqual({ r: 200, g: 200, b: 200, a: 255 });
	});
});

describe('TabState — snapshot', () => {
	it('toSnapshot captures id, name, dimensions, pixels, viewport', () => {
		const { tab } = makeTab({
			documentId: 'doc-snap',
			name: 'My Tab',
			canvasWidth: 8,
			canvasHeight: 8
		});

		const snap = tab.toSnapshot();

		expect(snap.id).toBe('doc-snap');
		expect(snap.name).toBe('My Tab');
		expect(snap.width).toBe(8);
		expect(snap.height).toBe(8);
		expect(snap.pixels).toBeInstanceOf(Uint8Array);
		expect(snap.pixels.length).toBe(8 * 8 * 4);
		expect(snap.viewport.zoom).toBe(tab.viewport.zoom);
	});

	it('snapshot pixels reflect current canvas contents after a draw', () => {
		const { tab, shared } = makeTab();
		shared.foregroundColor = BLACK;
		drawLine(tab, { x: 0, y: 0 }, { x: 3, y: 0 });

		const snap = tab.toSnapshot();
		const canvasPixels = tab.pixelCanvas.pixels();
		expect(snap.pixels).toEqual(canvasPixels);
		expect(getPixel(tab, 0, 0)).toEqual(BLACK);
	});
});

describe('TabState — undo/redo', () => {
	it('undo after a drawn line restores original pixels', () => {
		const { tab } = makeTab();
		const beforePixels = tab.pixelCanvas.pixels();
		drawLine(tab, { x: 0, y: 0 }, { x: 3, y: 0 });
		tab.undo();
		expect(tab.pixelCanvas.pixels()).toEqual(beforePixels);
	});

	it('redo replays the undone stroke', () => {
		const { tab } = makeTab();
		drawLine(tab, { x: 0, y: 0 }, { x: 3, y: 0 });
		const afterDrawPixels = tab.pixelCanvas.pixels();
		tab.undo();
		tab.redo();
		expect(tab.pixelCanvas.pixels()).toEqual(afterDrawPixels);
	});

	it('canUndo/canRedo reflect history availability', () => {
		const { tab } = makeTab();
		expect(tab.canUndo).toBe(false);
		expect(tab.canRedo).toBe(false);

		drawLine(tab, { x: 0, y: 0 }, { x: 3, y: 0 });
		expect(tab.canUndo).toBe(true);
		expect(tab.canRedo).toBe(false);

		tab.undo();
		expect(tab.canRedo).toBe(true);
	});
});
