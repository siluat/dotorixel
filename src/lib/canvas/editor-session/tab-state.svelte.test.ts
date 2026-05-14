// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { TabState, type TabStateDeps } from './tab-state.svelte';
import { wasmBackend, singleLayerDocument } from '../wasm-backend';
import { createFakeDirtyNotifier } from './fake-dirty-notifier';
import { SharedState } from '../shared-state.svelte';
import type { CanvasCoords } from '../canvas-model';
import type { Color } from '../color';
import { decodeReferenceBlob as samplerDecodeReferenceBlob } from '../../reference-images/decode-reference-blob';
import type { DecodedImage } from '../../reference-images/sample-pixel';

vi.mock('../../reference-images/decode-reference-blob', () => ({
	decodeReferenceBlob: vi.fn()
}));

vi.mock('../export', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../export')>();
	return { ...actual, exportAsPng: vi.fn() };
});

const mockedDecodeReferenceBlob = vi.mocked(samplerDecodeReferenceBlob);

/**
 * Build a `DecodedImage` whose pixels at integer coords are derived from a
 * function. Useful for predicting grid contents under sampling.
 */
function decodedImageBy(
	width: number,
	height: number,
	color: (x: number, y: number) => Color
): DecodedImage {
	const data = new Uint8ClampedArray(width * height * 4);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const c = color(x, y);
			const i = (y * width + x) * 4;
			data[i] = c.r;
			data[i + 1] = c.g;
			data[i + 2] = c.b;
			data[i + 3] = c.a;
		}
	}
	return { width, height, data };
}

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
	const pixels = tab.document.composite();
	const i = (y * tab.document.width + x) * 4;
	return { r: pixels[i], g: pixels[i + 1], b: pixels[i + 2], a: pixels[i + 3] };
}

describe('TabState — ownership', () => {
	it('owns its own document and viewport; two tabs do not share them', () => {
		const { tab: a } = makeTab({ documentId: 'a' });
		const { tab: b } = makeTab({ documentId: 'b' });
		expect(a.document).not.toBe(b.document);
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

	it('canvas resize triggers viewport reclamp against the new canvas dimensions', () => {
		const { tab } = makeTab({ canvasWidth: 32, canvasHeight: 32 });
		tab.setViewport({ ...tab.viewport, panX: 5000, panY: 5000 });

		tab.resize(8, 8);

		const reapplied = wasmBackend.viewportOps.clampPan(
			tab.viewport,
			tab.document.width,
			tab.document.height,
			tab.viewportSize.width,
			tab.viewportSize.height
		);
		expect(tab.viewport.panX).toBe(reapplied.panX);
		expect(tab.viewport.panY).toBe(reapplied.panY);
	});

	it('documentReplaced path: undo after resize swaps the document and bumps renderVersion', () => {
		const { tab } = makeTab({ canvasWidth: 8, canvasHeight: 8 });
		expect(tab.document.width).toBe(8);

		tab.resize(16, 16);
		expect(tab.document.width).toBe(16);
		expect(tab.document.height).toBe(16);

		const beforeUndo = tab.renderVersion;
		tab.undo();

		expect(tab.document.width).toBe(8);
		expect(tab.document.height).toBe(8);
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


describe('TabState — reference sampling integration', () => {
	const blob = new Blob([new Uint8Array([0])], { type: 'image/png' });

	it('a full reference-sampling cycle propagates effects through #applyEffects (foregroundColor, recentColors, markDirty)', async () => {
		// Lifecycle and race coverage live in `reference-sampling-session.svelte.test.ts`.
		// This test only verifies the wiring: the new module's commit effects
		// reach `shared.foregroundColor`, `shared.recentColors`, and
		// `notifier.markDirty` via `TabState`'s effect dispatcher.
		const SAMPLED: Color = { r: 12, g: 34, b: 56, a: 255 };
		mockedDecodeReferenceBlob.mockResolvedValueOnce(decodedImageBy(9, 9, () => SAMPLED));
		const { tab, shared, notifier } = makeTab({ documentId: 'doc-ref' });
		shared.foregroundColor = BLACK;
		shared.recentColors = [];
		notifier.reset();

		await tab.referenceSampleStart(blob, 4, 4, 'touch');
		tab.referenceSampleEnd();

		expect(shared.foregroundColor).toEqual(SAMPLED);
		expect(shared.recentColors).toEqual(['#0c2238']);
		expect(notifier.dirtyCalls).toContain('doc-ref');
	});
});

describe('TabState — snapshot', () => {
	it('toSnapshot captures id, name, dimensions, viewport, and a single Layer 1', () => {
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
		expect(snap.viewport.zoom).toBe(tab.viewport.zoom);
		expect(snap.layers).toHaveLength(1);
		expect(snap.layers[0].name).toBe('Layer 1');
		expect(snap.layers[0].pixels).toBeInstanceOf(Uint8Array);
		expect(snap.layers[0].pixels.length).toBe(8 * 8 * 4);
		expect(snap.layers[0].visible).toBe(true);
		expect(snap.layers[0].opacity).toBe(1);
		expect(snap.activeLayerId).toBe(snap.layers[0].id);
		expect(snap.nextLayerNumber).toBe(2);
		expect(snap.timelinePanelCollapsed).toBe(false);
	});

	it('snapshot active-layer pixels reflect the current document after a draw', () => {
		const { tab, shared } = makeTab();
		shared.foregroundColor = BLACK;
		drawLine(tab, { x: 0, y: 0 }, { x: 3, y: 0 });

		const snap = tab.toSnapshot();
		expect(snap.layers[0].pixels).toEqual(tab.document.layer_pixels_at(0));
		expect(getPixel(tab, 0, 0)).toEqual(BLACK);
	});

	it('serializes every layer with its id, name, visibility, opacity, and pixels', () => {
		const { tab } = makeTab({ canvasWidth: 4, canvasHeight: 4 });
		tab.addLayer('Layer 2');
		tab.addLayer('Layer 3');

		const snap = tab.toSnapshot();

		expect(snap.layers).toHaveLength(3);
		expect(snap.layers.map((l) => l.name)).toEqual(['Layer 1', 'Layer 2', 'Layer 3']);
		for (let i = 0; i < snap.layers.length; i++) {
			expect(snap.layers[i].id).toBe(tab.document.layer_id_at(i));
			expect(snap.layers[i].visible).toBe(tab.document.layer_visible_at(i));
			expect(snap.layers[i].opacity).toBe(tab.document.layer_opacity_at(i));
			expect(snap.layers[i].pixels).toEqual(tab.document.layer_pixels_at(i));
		}
		expect(snap.activeLayerId).toBe(tab.document.active_layer_id());
		expect(snap.nextLayerNumber).toBe(tab.document.next_layer_number());
		expect(snap.timelinePanelCollapsed).toBe(tab.document.is_timeline_panel_collapsed());
	});
});

describe('TabState — tools write to document active layer', () => {
	it('pencil stroke is reflected in document.layer_pixels_at(0)', () => {
		const { tab, shared } = makeTab();
		shared.foregroundColor = BLACK;
		shared.activeTool = 'pencil';
		tab.drawStart(0, 'mouse');
		tab.draw({ x: 2, y: 2 }, null);
		tab.drawEnd();

		const layerPixels = tab.document.layer_pixels_at(0);
		expect(layerPixels).toBeDefined();
		const i = (2 * tab.document.width + 2) * 4;
		expect(Array.from(layerPixels!.slice(i, i + 4))).toEqual([0, 0, 0, 255]);
	});

	it('flood fill is reflected in document.layer_pixels_at(0)', () => {
		const { tab, shared } = makeTab();
		shared.foregroundColor = BLACK;
		shared.activeTool = 'floodfill';
		tab.drawStart(0, 'mouse');
		tab.draw({ x: 0, y: 0 }, null);
		tab.drawEnd();

		const layerPixels = tab.document.layer_pixels_at(0)!;
		// Every pixel of the single layer should now be black.
		for (let i = 0; i < layerPixels.length; i += 4) {
			expect([layerPixels[i], layerPixels[i + 1], layerPixels[i + 2], layerPixels[i + 3]]).toEqual(
				[0, 0, 0, 255]
			);
		}
	});
});

describe('TabState — toSnapshot derives from document', () => {
	it('snapshot dimensions and layer 0 pixels match the underlying document', () => {
		const { tab } = makeTab();
		const RED: Color = { r: 255, g: 0, b: 0, a: 255 };
		const w = tab.document.width;
		const h = tab.document.height;
		const docPixels = new Uint8Array(w * h * 4);
		const i = (3 * w + 3) * 4;
		docPixels[i] = RED.r;
		docPixels[i + 1] = RED.g;
		docPixels[i + 2] = RED.b;
		docPixels[i + 3] = RED.a;
		tab.document = singleLayerDocument(w, h, docPixels);

		const snap = tab.toSnapshot();
		expect(snap.width).toBe(tab.document.width);
		expect(snap.height).toBe(tab.document.height);
		expect(snap.layers[0].pixels).toEqual(tab.document.layer_pixels_at(0));
	});
});

describe('TabState — exportPng uses document.composite()', () => {
	it('passes a canvas whose pixels match document.composite()', async () => {
		const exportModule = await import('../export');
		const exportSpy = vi.mocked(exportModule.exportAsPng);
		exportSpy.mockClear();

		const { tab } = makeTab();
		const RED: Color = { r: 255, g: 0, b: 0, a: 255 };
		const w = tab.document.width;
		const h = tab.document.height;
		const docPixels = new Uint8Array(w * h * 4);
		const i = (3 * w + 3) * 4;
		docPixels[i] = RED.r;
		docPixels[i + 1] = RED.g;
		docPixels[i + 2] = RED.b;
		docPixels[i + 3] = RED.a;
		tab.document = singleLayerDocument(w, h, docPixels);

		tab.exportPng();

		expect(exportSpy).toHaveBeenCalledTimes(1);
		const passed = exportSpy.mock.calls[0][0] as { width: number; height: number; pixels(): Uint8Array };
		expect(passed.width).toBe(w);
		expect(passed.height).toBe(h);
		expect(passed.pixels()).toEqual(tab.document.composite());
	});
});

describe('TabState — resize updates the document', () => {
	it('resize changes document width and height to match new canvas dims', () => {
		const { tab } = makeTab({ canvasWidth: 8, canvasHeight: 8 });
		tab.resize(16, 12);
		expect(tab.document.width).toBe(16);
		expect(tab.document.height).toBe(12);
	});

	it('resize preserves active-layer pixels with the anchor (top-left default)', () => {
		const { tab, shared } = makeTab({ canvasWidth: 4, canvasHeight: 4 });
		shared.foregroundColor = BLACK;
		shared.activeTool = 'pencil';
		tab.drawStart(0, 'mouse');
		tab.draw({ x: 0, y: 0 }, null);
		tab.drawEnd();

		tab.resize(8, 8);

		const layer = tab.document.layer_pixels_at(0)!;
		const i = (0 * tab.document.width + 0) * 4;
		expect(Array.from(layer.slice(i, i + 4))).toEqual([0, 0, 0, 255]);
	});
});

describe('TabState — history snapshots the whole document', () => {
	it('undo restores document active-layer pixels', () => {
		const { tab, shared } = makeTab();
		shared.foregroundColor = BLACK;
		shared.activeTool = 'pencil';

		tab.drawStart(0, 'mouse');
		tab.draw({ x: 2, y: 2 }, null);
		tab.drawEnd();

		const i = (2 * tab.document.width + 2) * 4;
		expect(Array.from(tab.document.layer_pixels_at(0)!.slice(i, i + 4))).toEqual([0, 0, 0, 255]);

		tab.undo();

		expect(Array.from(tab.document.layer_pixels_at(0)!.slice(i, i + 4))).toEqual([0, 0, 0, 0]);
	});

	it('redo re-applies pencil stroke to document active layer', () => {
		const { tab, shared } = makeTab();
		shared.foregroundColor = BLACK;
		shared.activeTool = 'pencil';

		tab.drawStart(0, 'mouse');
		tab.draw({ x: 2, y: 2 }, null);
		tab.drawEnd();
		tab.undo();
		tab.redo();

		const i = (2 * tab.document.width + 2) * 4;
		expect(Array.from(tab.document.layer_pixels_at(0)!.slice(i, i + 4))).toEqual([0, 0, 0, 255]);
	});
});

describe('TabState — sampling reads from document active layer', () => {
	it('eyedropper picks color from document', () => {
		const { tab, shared } = makeTab();
		const RED: Color = { r: 255, g: 0, b: 0, a: 255 };

		const w = tab.document.width;
		const h = tab.document.height;
		const pixels = new Uint8Array(w * h * 4);
		const i = (3 * w + 3) * 4;
		pixels[i] = RED.r;
		pixels[i + 1] = RED.g;
		pixels[i + 2] = RED.b;
		pixels[i + 3] = RED.a;
		tab.document = singleLayerDocument(w, h, pixels);

		shared.foregroundColor = BLACK;
		shared.activeTool = 'eyedropper';
		tab.drawStart(0, 'mouse');
		tab.draw({ x: 3, y: 3 }, null);
		tab.drawEnd();

		expect(shared.foregroundColor).toEqual(RED);
	});
});

describe('TabState — document dimensions', () => {
	it('document dimensions match the requested canvas size', () => {
		const { tab } = makeTab({ canvasWidth: 12, canvasHeight: 7 });
		expect(tab.document.width).toBe(12);
		expect(tab.document.height).toBe(7);
	});
});

describe('TabState — undo/redo', () => {
	it('undo after a drawn line restores original pixels', () => {
		const { tab } = makeTab();
		const beforePixels = tab.document.composite();
		drawLine(tab, { x: 0, y: 0 }, { x: 3, y: 0 });
		tab.undo();
		expect(tab.document.composite()).toEqual(beforePixels);
	});

	it('redo replays the undone stroke', () => {
		const { tab } = makeTab();
		drawLine(tab, { x: 0, y: 0 }, { x: 3, y: 0 });
		const afterDrawPixels = tab.document.composite();
		tab.undo();
		tab.redo();
		expect(tab.document.composite()).toEqual(afterDrawPixels);
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

describe('TabState — constructor accepts document', () => {
	it('adopts a passed document and exposes its dimensions and composite pixels', () => {
		const w = 4;
		const h = 4;
		const pixels = new Uint8Array(w * h * 4);
		const RED: Color = { r: 255, g: 0, b: 0, a: 255 };
		const i = (1 * w + 2) * 4;
		pixels[i] = RED.r;
		pixels[i + 1] = RED.g;
		pixels[i + 2] = RED.b;
		pixels[i + 3] = RED.a;
		const doc = singleLayerDocument(w, h, pixels);

		const { tab } = makeTab({ document: doc, canvasWidth: undefined, canvasHeight: undefined });

		expect(tab.document).toBe(doc);
		expect(tab.document.width).toBe(w);
		expect(tab.document.height).toBe(h);
		const px = tab.document.composite();
		expect(px[i]).toBe(RED.r);
		expect(px[i + 1]).toBe(RED.g);
		expect(px[i + 2]).toBe(RED.b);
		expect(px[i + 3]).toBe(RED.a);
	});
});


describe('TabState — addLayer', () => {
	it('increments document.layer_count by 1', () => {
		const { tab } = makeTab();
		const before = tab.document.layer_count();

		tab.addLayer('Layer 2');

		expect(tab.document.layer_count()).toBe(before + 1);
	});

	it('makes the newly added layer the active layer', () => {
		const { tab } = makeTab();
		const previousActiveId = tab.document.active_layer_id();

		tab.addLayer('Layer 2');

		expect(tab.document.active_layer_id()).not.toBe(previousActiveId);
	});

	it('uses the given string as the new layer name', () => {
		const { tab } = makeTab();

		tab.addLayer('레이어 2');

		const newIndex = tab.document.layer_count() - 1;
		expect(tab.document.layer_name_at(newIndex)).toBe('레이어 2');
	});

	it('advances next_layer_number monotonically (never reused)', () => {
		const { tab } = makeTab();
		const start = tab.document.next_layer_number();

		tab.addLayer('Layer 2');
		expect(tab.document.next_layer_number()).toBe(start + 1);

		tab.addLayer('Layer 3');
		expect(tab.document.next_layer_number()).toBe(start + 2);
	});

	it('is undoable: undo restores the prior layer count and active layer', () => {
		const { tab } = makeTab();
		const baseCount = tab.document.layer_count();
		const baseActive = tab.document.active_layer_id();

		tab.addLayer('Layer 2');
		expect(tab.document.layer_count()).toBe(baseCount + 1);

		tab.undo();

		expect(tab.document.layer_count()).toBe(baseCount);
		expect(tab.document.active_layer_id()).toBe(baseActive);
	});

	it('bumps renderVersion and emits markDirty', () => {
		const { tab, notifier } = makeTab();
		const before = tab.renderVersion;
		notifier.reset();

		tab.addLayer('Layer 2');

		expect(tab.renderVersion).toBeGreaterThan(before);
		expect(notifier.dirtyCalls).toContain('doc-test');
	});

	it('the new active layer is empty (its pixels are fully transparent)', () => {
		const { tab, shared } = makeTab();
		shared.foregroundColor = BLACK;
		shared.activeTool = 'pencil';
		tab.drawStart(0, 'mouse');
		tab.draw({ x: 2, y: 2 }, null);
		tab.drawEnd();

		tab.addLayer('Layer 2');

		const layer = tab.document.layer_pixels_at(tab.document.layer_count() - 1)!;
		for (let i = 0; i < layer.length; i += 4) {
			expect(layer[i + 3]).toBe(0);
		}
	});
});

describe('TabState — removeLayer', () => {
	it('decrements document.layer_count by 1', () => {
		const { tab } = makeTab();
		tab.addLayer('Layer 2');
		const layer1Id = tab.document.layer_id_at(0)!;
		const before = tab.document.layer_count();

		tab.removeLayer(layer1Id);

		expect(tab.document.layer_count()).toBe(before - 1);
	});

	it('reassigns the active pointer to an adjacent layer when the active layer is removed', () => {
		const { tab } = makeTab();
		tab.addLayer('Layer 2');
		const activeId = tab.document.active_layer_id();
		const otherId = tab.document.layer_id_at(0)!;
		expect(activeId).not.toBe(otherId);

		tab.removeLayer(activeId);

		expect(tab.document.active_layer_id()).toBe(otherId);
	});

	it('leaves the active pointer unchanged when a non-active layer is removed', () => {
		const { tab } = makeTab();
		tab.addLayer('Layer 2');
		const activeId = tab.document.active_layer_id();
		const otherId = tab.document.layer_id_at(0)!;

		tab.removeLayer(otherId);

		expect(tab.document.active_layer_id()).toBe(activeId);
	});

	it('is undoable: undo restores the prior layer count and active layer', () => {
		const { tab } = makeTab();
		tab.addLayer('Layer 2');
		const beforeCount = tab.document.layer_count();
		const beforeActive = tab.document.active_layer_id();
		const otherId = tab.document.layer_id_at(0)!;

		tab.removeLayer(otherId);
		expect(tab.document.layer_count()).toBe(beforeCount - 1);

		tab.undo();

		expect(tab.document.layer_count()).toBe(beforeCount);
		expect(tab.document.active_layer_id()).toBe(beforeActive);
	});

	it('bumps renderVersion and emits markDirty', () => {
		const { tab, notifier } = makeTab();
		tab.addLayer('Layer 2');
		const otherId = tab.document.layer_id_at(0)!;
		const renderBefore = tab.renderVersion;
		notifier.reset();

		tab.removeLayer(otherId);

		expect(tab.renderVersion).toBeGreaterThan(renderBefore);
		expect(notifier.dirtyCalls).toContain('doc-test');
	});

	it('is a no-op on the last remaining layer: count, active, renderVersion, and markDirty are untouched', () => {
		const { tab, notifier } = makeTab();
		const onlyId = tab.document.active_layer_id();
		const renderBefore = tab.renderVersion;
		notifier.reset();

		tab.removeLayer(onlyId);

		expect(tab.document.layer_count()).toBe(1);
		expect(tab.document.active_layer_id()).toBe(onlyId);
		expect(tab.renderVersion).toBe(renderBefore);
		expect(notifier.dirtyCalls).toEqual([]);
	});

	it('the last-layer no-op also leaves the undo stack untouched (no orphan snapshot)', () => {
		const { tab, shared } = makeTab();
		shared.foregroundColor = BLACK;
		shared.activeTool = 'pencil';
		tab.drawStart(0, 'mouse');
		tab.draw({ x: 2, y: 2 }, null);
		tab.drawEnd();
		expect(getPixel(tab, 2, 2).a).toBe(255);

		const onlyId = tab.document.active_layer_id();
		tab.removeLayer(onlyId);

		// Single undo should revert the prior draw — not consume an orphan snapshot.
		tab.undo();
		expect(getPixel(tab, 2, 2).a).toBe(0);
	});
});

describe('TabState — setActiveLayer', () => {
	it('changes active_layer_id, bumps renderVersion, and emits markDirty when called with a different layer id', () => {
		const { tab, notifier } = makeTab();
		tab.addLayer('Layer 2');
		const layer1Id = tab.document.layer_id_at(0)!;
		const layer2Id = tab.document.active_layer_id();
		expect(layer1Id).not.toBe(layer2Id);

		const renderBefore = tab.renderVersion;
		notifier.reset();

		tab.setActiveLayer(layer1Id);

		expect(tab.document.active_layer_id()).toBe(layer1Id);
		expect(tab.renderVersion).toBeGreaterThan(renderBefore);
		expect(notifier.dirtyCalls).toContain('doc-test');
	});

	it('is a no-op when called with the already-active layer id', () => {
		const { tab, notifier } = makeTab();
		tab.addLayer('Layer 2');
		const activeId = tab.document.active_layer_id();

		const renderBefore = tab.renderVersion;
		notifier.reset();

		tab.setActiveLayer(activeId);

		expect(tab.document.active_layer_id()).toBe(activeId);
		expect(tab.renderVersion).toBe(renderBefore);
		expect(notifier.dirtyCalls).toEqual([]);
	});

	it('is not undoable: undo after several setActiveLayer calls reverts the prior content op in a single step', () => {
		const { tab } = makeTab();
		tab.addLayer('Layer 2');
		const layer1Id = tab.document.layer_id_at(0)!;
		const layer2Id = tab.document.active_layer_id();

		tab.setActiveLayer(layer1Id);
		tab.setActiveLayer(layer2Id);
		tab.setActiveLayer(layer1Id);

		tab.undo();

		expect(tab.document.layer_count()).toBe(1);
	});

	it('after activating a different layer, subsequent draws apply to that layer', () => {
		const { tab, shared } = makeTab();
		tab.addLayer('Layer 2');
		const layer1Id = tab.document.layer_id_at(0)!;
		const layer2Idx = tab.document.layer_count() - 1;

		tab.setActiveLayer(layer1Id);

		shared.foregroundColor = BLACK;
		shared.activeTool = 'pencil';
		tab.drawStart(0, 'mouse');
		tab.draw({ x: 2, y: 2 }, null);
		tab.drawEnd();

		const i = (2 * tab.document.width + 2) * 4;
		const layer1Pixels = tab.document.layer_pixels_at(0)!;
		expect(Array.from(layer1Pixels.slice(i, i + 4))).toEqual([0, 0, 0, 255]);

		const layer2Pixels = tab.document.layer_pixels_at(layer2Idx)!;
		expect(layer2Pixels[i + 3]).toBe(0);
	});
});

describe('TabState — reorderLayer', () => {
	// `reorderLayer` takes a *visual* index in panel order (top of panel = visual 0),
	// while the document stack runs bottom-to-top (`layer 0` = z-bottom). The
	// public-API behavior locked here is the visual contract — these tests are
	// what guard the `(count - 1) - visual_idx` mapping from silently inverting.

	it('moving the top-of-panel layer (visual 0) to the bottom (visual layers-1) puts it at stack index 0', () => {
		const { tab } = makeTab();
		tab.addLayer('Layer 2');
		tab.addLayer('Layer 3');
		// Stack (bottom→top): [Layer 1, Layer 2, Layer 3]
		// Panel (top→bottom): [Layer 3, Layer 2, Layer 1]
		const layer3Id = tab.document.layer_id_at(2)!;

		tab.reorderLayer(layer3Id, 2); // move Layer 3 to the panel's bottom row

		// Now expected stack: [Layer 3, Layer 1, Layer 2]
		expect(tab.document.layer_id_at(0)).toBe(layer3Id);
	});

	it('moving the bottom-of-panel layer (visual layers-1) to the top (visual 0) puts it at stack index layers-1', () => {
		const { tab } = makeTab();
		tab.addLayer('Layer 2');
		tab.addLayer('Layer 3');
		const layer1Id = tab.document.layer_id_at(0)!;

		tab.reorderLayer(layer1Id, 0); // move Layer 1 (panel bottom) to the panel's top row

		const top = tab.document.layer_count() - 1;
		expect(tab.document.layer_id_at(top)).toBe(layer1Id);
	});

	it('preserves the active layer pointer across reordering (it is tracked by id, not index)', () => {
		const { tab } = makeTab();
		tab.addLayer('Layer 2');
		tab.addLayer('Layer 3');
		const activeId = tab.document.active_layer_id(); // Layer 3 (newly added)

		tab.reorderLayer(activeId, 2); // move active from panel top to panel bottom

		expect(tab.document.active_layer_id()).toBe(activeId);
	});

	it('is undoable: undo restores the prior stack order', () => {
		const { tab } = makeTab();
		tab.addLayer('Layer 2');
		tab.addLayer('Layer 3');
		const layer1Id = tab.document.layer_id_at(0)!;
		const layer2Id = tab.document.layer_id_at(1)!;
		const layer3Id = tab.document.layer_id_at(2)!;

		tab.reorderLayer(layer3Id, 2); // [Layer 3, Layer 1, Layer 2]
		expect([
			tab.document.layer_id_at(0),
			tab.document.layer_id_at(1),
			tab.document.layer_id_at(2)
		]).toEqual([layer3Id, layer1Id, layer2Id]);

		tab.undo();

		expect([
			tab.document.layer_id_at(0),
			tab.document.layer_id_at(1),
			tab.document.layer_id_at(2)
		]).toEqual([layer1Id, layer2Id, layer3Id]);
	});

	it('bumps renderVersion and emits markDirty', () => {
		const { tab, notifier } = makeTab();
		tab.addLayer('Layer 2');
		const layer1Id = tab.document.layer_id_at(0)!;
		const renderBefore = tab.renderVersion;
		notifier.reset();

		tab.reorderLayer(layer1Id, 0);

		expect(tab.renderVersion).toBeGreaterThan(renderBefore);
		expect(notifier.dirtyCalls).toContain('doc-test');
	});

	it('is a no-op when the target visual index matches the layer’s current visual index', () => {
		const { tab, notifier } = makeTab();
		tab.addLayer('Layer 2');
		const layer2Id = tab.document.active_layer_id(); // currently panel top (visual 0)
		const renderBefore = tab.renderVersion;
		notifier.reset();

		tab.reorderLayer(layer2Id, 0);

		expect(tab.renderVersion).toBe(renderBefore);
		expect(notifier.dirtyCalls).toEqual([]);
	});

	it('the no-op branch also leaves the undo stack untouched (no orphan snapshot)', () => {
		const { tab, shared } = makeTab();
		shared.foregroundColor = BLACK;
		shared.activeTool = 'pencil';
		tab.drawStart(0, 'mouse');
		tab.draw({ x: 2, y: 2 }, null);
		tab.drawEnd();

		const onlyId = tab.document.active_layer_id();
		tab.reorderLayer(onlyId, 0); // visual index unchanged → no-op

		tab.undo();
		expect(getPixel(tab, 2, 2).a).toBe(0);
	});
});

describe('TabState — setLayerVisibility', () => {
	it('flips Layer.visible to false on the targeted layer', () => {
		const { tab } = makeTab();
		const layerId = tab.document.active_layer_id();

		tab.setLayerVisibility(layerId, false);

		expect(tab.document.layer_visible_at(0)).toBe(false);
	});

	it('restores Layer.visible to true from a hidden state', () => {
		const { tab } = makeTab();
		const layerId = tab.document.active_layer_id();
		tab.setLayerVisibility(layerId, false);
		expect(tab.document.layer_visible_at(0)).toBe(false);

		tab.setLayerVisibility(layerId, true);

		expect(tab.document.layer_visible_at(0)).toBe(true);
	});

	it('affects only the targeted layer; sibling layers retain their visibility', () => {
		const { tab } = makeTab();
		tab.addLayer('Layer 2');
		const layer1Id = tab.document.layer_id_at(0)!;
		const layer2Id = tab.document.layer_id_at(1)!;

		tab.setLayerVisibility(layer1Id, false);

		expect(tab.document.layer_visible_at(0)).toBe(false);
		expect(tab.document.layer_visible_at(1)).toBe(true);
		expect(tab.document.active_layer_id()).toBe(layer2Id);
	});

	it('bumps renderVersion and emits markDirty on a real change', () => {
		const { tab, notifier } = makeTab();
		const layerId = tab.document.active_layer_id();
		const renderBefore = tab.renderVersion;
		notifier.reset();

		tab.setLayerVisibility(layerId, false);

		expect(tab.renderVersion).toBeGreaterThan(renderBefore);
		expect(notifier.dirtyCalls).toContain('doc-test');
	});

	it('is undoable: undo restores the prior visibility', () => {
		const { tab } = makeTab();
		const layerId = tab.document.active_layer_id();
		expect(tab.document.layer_visible_at(0)).toBe(true);

		tab.setLayerVisibility(layerId, false);
		expect(tab.document.layer_visible_at(0)).toBe(false);

		tab.undo();

		expect(tab.document.layer_visible_at(0)).toBe(true);
	});

	it('is a no-op when called with the current visibility (no renderVersion bump, no markDirty)', () => {
		const { tab, notifier } = makeTab();
		const layerId = tab.document.active_layer_id();
		expect(tab.document.layer_visible_at(0)).toBe(true);
		const renderBefore = tab.renderVersion;
		notifier.reset();

		tab.setLayerVisibility(layerId, true);

		expect(tab.document.layer_visible_at(0)).toBe(true);
		expect(tab.renderVersion).toBe(renderBefore);
		expect(notifier.dirtyCalls).toEqual([]);
	});

	it('the no-op branch also leaves the undo stack untouched (no orphan snapshot)', () => {
		const { tab, shared } = makeTab();
		shared.foregroundColor = BLACK;
		shared.activeTool = 'pencil';
		tab.drawStart(0, 'mouse');
		tab.draw({ x: 2, y: 2 }, null);
		tab.drawEnd();
		expect(getPixel(tab, 2, 2).a).toBe(255);

		const layerId = tab.document.active_layer_id();
		tab.setLayerVisibility(layerId, true); // already visible → no-op

		tab.undo();
		expect(getPixel(tab, 2, 2).a).toBe(0);
	});
});

describe('TabState — compositeBuffer reflects all visible layers', () => {
	it('width and height match the document', () => {
		const { tab } = makeTab({ canvasWidth: 12, canvasHeight: 7 });
		expect(tab.compositeBuffer.width).toBe(tab.document.width);
		expect(tab.compositeBuffer.height).toBe(tab.document.height);
	});

	it('pixels() equals document.composite()', () => {
		const { tab, shared } = makeTab();
		shared.foregroundColor = BLACK;
		shared.activeTool = 'pencil';
		tab.drawStart(0, 'mouse');
		tab.draw({ x: 2, y: 2 }, null);
		tab.drawEnd();

		expect(tab.compositeBuffer.pixels()).toEqual(tab.document.composite());
	});

	it('shows pixels from lower layers when the active layer is empty (the bug 102 fixes)', () => {
		const RED: Color = { r: 255, g: 0, b: 0, a: 255 };
		const { tab, shared } = makeTab();
		shared.foregroundColor = RED;
		shared.activeTool = 'pencil';
		tab.drawStart(0, 'mouse');
		tab.draw({ x: 2, y: 2 }, null);
		tab.drawEnd();

		tab.addLayer('Layer 2');

		const buf = tab.compositeBuffer;
		const i = (2 * buf.width + 2) * 4;
		const px = buf.pixels();
		expect([px[i], px[i + 1], px[i + 2], px[i + 3]]).toEqual([255, 0, 0, 255]);
	});
});
