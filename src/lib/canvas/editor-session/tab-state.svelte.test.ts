// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { TabState, type TabStateDeps } from './tab-state.svelte';
import {
	wasmBackend,
	singleLayerDocument,
	documentFromLayerSource,
	marqueeRegionFromDrag
} from '../wasm-backend';
import { createFakeDirtyNotifier } from './fake-dirty-notifier';
import { SharedState } from '../shared-state.svelte';
import type { CanvasCoords } from '../canvas-model';
import type { Color } from '../color';
import { LOUPE_CENTER_INDEX } from '../sampling/loupe-config';
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
const RED: Color = { r: 255, g: 0, b: 0, a: 255 };
const GREEN: Color = { r: 0, g: 255, b: 0, a: 255 };
const BLUE: Color = { r: 0, g: 0, b: 255, a: 255 };

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

function expectPixelLayer(layer: ReturnType<TabState['toSnapshot']>['layers'][number]) {
	expect(layer.kind).toBe('pixel');
	if (layer.kind !== 'pixel') throw new Error('Expected Pixel Layer');
	return layer;
}

function expectReferenceLayer(layer: ReturnType<TabState['toSnapshot']>['layers'][number]) {
	expect(layer.kind).toBe('reference');
	if (layer.kind !== 'reference') throw new Error('Expected Reference Layer');
	return layer;
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

function getRenderedPixel(tab: TabState, x: number, y: number): Color {
	const pixels = tab.compositeBuffer.pixels();
	const i = (y * tab.compositeBuffer.width + x) * 4;
	return { r: pixels[i], g: pixels[i + 1], b: pixels[i + 2], a: pixels[i + 3] };
}

function getPixelFromBuffer(pixels: Uint8Array, width: number, x: number, y: number): Color {
	const i = (y * width + x) * 4;
	return { r: pixels[i], g: pixels[i + 1], b: pixels[i + 2], a: pixels[i + 3] };
}

function makePixelRgba(color: Color): Uint8Array {
	return new Uint8Array([color.r, color.g, color.b, color.a]);
}

function makeReferenceDocumentWithPlacement(placement: { x: number; y: number; scale: number }) {
	const pixelId = crypto.randomUUID();
	const referenceId = crypto.randomUUID();
	return {
		referenceId,
		document: documentFromLayerSource({
			width: 20,
			height: 20,
			layers: [
				{
					kind: 'pixel',
					id: pixelId,
					name: 'Paint',
					pixels: new Uint8Array(20 * 20 * 4),
					visible: true,
					opacity: 1
				},
				{
					kind: 'reference',
					id: referenceId,
					name: 'Reference',
					visible: true,
					opacity: 1,
					sourceBlob: new Blob([new Uint8Array([1])], { type: 'image/png' }),
					sourceRgba: new Uint8Array([
						255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255,
						255, 255, 0, 255, 255, 0, 255, 255, 0, 255, 255, 255, 32, 32, 32, 255
					]),
					naturalWidth: 4,
					naturalHeight: 2,
					placement
				}
			],
			activeLayerId: referenceId,
			nextLayerNumber: 2,
			timelinePanelCollapsed: false
		})
	};
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

	it('selection drag previews transiently and marks dirty only on commit', () => {
		const { tab, notifier, shared } = makeTab();
		shared.activeTool = 'selection';
		const before = tab.renderVersion;

		tab.drawStart(0, 'mouse');
		tab.draw({ x: -2, y: 1 }, null);
		tab.draw({ x: 3, y: 4 }, { x: -2, y: 1 });

		expect(tab.renderVersion).toBeGreaterThan(before);
		expect(notifier.dirtyCalls).toEqual([]);

		tab.drawEnd();

		expect(tab.document.marquee()).toMatchObject({ x: 0, y: 1, width: 4, height: 4 });
		expect(notifier.dirtyCalls).toEqual(['doc-test']);
	});

	it('toSnapshot keeps the committed Marquee while a selection preview is live', () => {
		const { tab, shared } = makeTab();
		shared.activeTool = 'selection';

		tab.drawStart(0, 'mouse');
		tab.draw({ x: 1, y: 1 }, null);
		tab.draw({ x: 3, y: 3 }, { x: 1, y: 1 });
		tab.drawEnd();

		expect(tab.toSnapshot().marquee).toEqual({ x: 1, y: 1, width: 3, height: 3 });

		tab.drawStart(0, 'mouse');
		tab.draw({ x: 5, y: 5 }, null);
		tab.draw({ x: 6, y: 6 }, { x: 5, y: 5 });

		expect(tab.document.marquee()).toMatchObject({ x: 5, y: 5, width: 2, height: 2 });
		expect(tab.toSnapshot().marquee).toEqual({ x: 1, y: 1, width: 3, height: 3 });

		tab.drawEnd();

		expect(tab.toSnapshot().marquee).toEqual({ x: 5, y: 5, width: 2, height: 2 });
	});

	it('drawEnd exposes the committed Marquee to synchronous dirty snapshots', () => {
		const shared = new SharedState();
		shared.activeTool = 'selection';
		let tab: TabState | undefined;
		const dirtySnapshots: Array<ReturnType<TabState['toSnapshot']>['marquee']> = [];
		tab = new TabState({
			backend: wasmBackend,
			shared,
			keyboard: { getShiftHeld: () => false },
			notifier: {
				markDirty() {
					if (!tab) throw new Error('Expected TabState to be initialized');
					dirtySnapshots.push(tab.toSnapshot().marquee);
				},
				notifyTabRemoved() {}
			},
			documentId: 'doc-test',
			name: 'Untitled 1',
			canvasWidth: 8,
			canvasHeight: 8
		});

		tab.drawStart(0, 'mouse');
		tab.draw({ x: 1, y: 1 }, null);
		tab.draw({ x: 3, y: 3 }, { x: 1, y: 1 });
		tab.drawEnd();
		dirtySnapshots.length = 0;

		tab.drawStart(0, 'mouse');
		tab.draw({ x: 5, y: 5 }, null);
		tab.draw({ x: 6, y: 6 }, { x: 5, y: 5 });
		tab.drawEnd();

		expect(dirtySnapshots).toEqual([{ x: 5, y: 5, width: 2, height: 2 }]);
	});

	it('selection drawCancel restores the previous Marquee without a dirty commit', () => {
		const { tab, notifier, shared } = makeTab();
		shared.activeTool = 'selection';

		tab.drawStart(0, 'mouse');
		tab.draw({ x: 1, y: 1 }, null);
		tab.draw({ x: 3, y: 3 }, { x: 1, y: 1 });
		tab.drawEnd();
		notifier.reset();
		const beforeCancelPreview = tab.renderVersion;

		tab.drawStart(0, 'mouse');
		tab.draw({ x: 5, y: 5 }, null);
		tab.draw({ x: 6, y: 6 }, { x: 5, y: 5 });
		expect(tab.document.marquee()).toMatchObject({ x: 5, y: 5, width: 2, height: 2 });

		tab.drawCancel();

		expect(tab.document.marquee()).toMatchObject({ x: 1, y: 1, width: 3, height: 3 });
		expect(tab.renderVersion).toBeGreaterThan(beforeCancelPreview);
		expect(notifier.dirtyCalls).toEqual([]);
		expect(tab.drawEnd()).toBeUndefined();
	});

	it('off-canvas-only selection drag restores the previous Marquee without a dirty commit', () => {
		const { tab, notifier, shared } = makeTab();
		shared.activeTool = 'selection';

		tab.drawStart(0, 'mouse');
		tab.draw({ x: 1, y: 1 }, null);
		tab.draw({ x: 3, y: 3 }, { x: 1, y: 1 });
		tab.drawEnd();
		notifier.reset();
		const beforeInvalidSelection = tab.renderVersion;

		tab.drawStart(0, 'mouse');
		tab.draw({ x: -5, y: -5 }, null);
		tab.draw({ x: -2, y: -2 }, { x: -5, y: -5 });
		expect(tab.document.marquee()).toBeUndefined();

		tab.drawEnd();

		expect(tab.document.marquee()).toMatchObject({ x: 1, y: 1, width: 3, height: 3 });
		expect(tab.renderVersion).toBeGreaterThan(beforeInvalidSelection);
		expect(notifier.dirtyCalls).toEqual([]);
	});

	it('clearMarquee removes the Marquee through an undoable document change', () => {
		const { tab, notifier, shared } = makeTab();
		shared.activeTool = 'selection';
		tab.drawStart(0, 'mouse');
		tab.draw({ x: 1, y: 1 }, null);
		tab.draw({ x: 3, y: 3 }, { x: 1, y: 1 });
		tab.drawEnd();
		notifier.reset();

		tab.clearMarquee();

		expect(tab.document.marquee()).toBeUndefined();
		expect(notifier.dirtyCalls).toEqual(['doc-test']);

		tab.undo();
		expect(tab.document.marquee()).toMatchObject({ x: 1, y: 1, width: 3, height: 3 });
	});

	it('clearMarqueeOrFloating clears the Marquee when no Floating Selection exists', () => {
		const { tab, notifier, shared } = makeTab();
		shared.activeTool = 'selection';
		tab.drawStart(0, 'mouse');
		tab.draw({ x: 1, y: 1 }, null);
		tab.draw({ x: 3, y: 3 }, { x: 1, y: 1 });
		tab.drawEnd();
		notifier.reset();

		tab.clearMarqueeOrFloating();

		expect(tab.document.marquee()).toBeUndefined();
		expect(notifier.dirtyCalls).toEqual(['doc-test']);

		tab.undo();
		expect(tab.document.marquee()).toMatchObject({ x: 1, y: 1, width: 3, height: 3 });
	});

	it('clearMarqueePixels clears selected pixels without removing the Marquee', () => {
		const pixels = new Uint8Array(8 * 8 * 4);
		pixels.set(makePixelRgba(RED), 0);
		pixels.set(makePixelRgba(GREEN), (1 * 8 + 1) * 4);
		const { tab, notifier } = makeTab({ document: singleLayerDocument(8, 8, pixels) });
		tab.document.set_marquee(marqueeRegionFromDrag(1, 1, 1, 1));
		notifier.reset();

		tab.clearMarqueePixels();

		expect(getPixel(tab, 0, 0)).toEqual(RED);
		expect(getPixel(tab, 1, 1)).toEqual({ r: 0, g: 0, b: 0, a: 0 });
		expect(tab.document.marquee()).toMatchObject({ x: 1, y: 1, width: 1, height: 1 });
		expect(notifier.dirtyCalls).toEqual(['doc-test']);

		tab.undo();
		expect(getPixel(tab, 1, 1)).toEqual(GREEN);
		expect(tab.document.marquee()).toMatchObject({ x: 1, y: 1, width: 1, height: 1 });
	});

	it('clearMarqueePixels is silent when no Marquee exists', () => {
		const pixels = new Uint8Array(8 * 8 * 4);
		pixels.set(makePixelRgba(GREEN), (1 * 8 + 1) * 4);
		const { tab, notifier } = makeTab({ document: singleLayerDocument(8, 8, pixels) });
		notifier.reset();

		tab.clearMarqueePixels();

		expect(getPixel(tab, 1, 1)).toEqual(GREEN);
		expect(notifier.dirtyCalls).toEqual([]);
	});

	it('flipHorizontal mirrors the active Pixel Layer as one undoable change', () => {
		const pixels = new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255]);
		const { tab, notifier } = makeTab({
			document: singleLayerDocument(2, 1, pixels),
			canvasWidth: 2,
			canvasHeight: 1
		});
		notifier.reset();

		tab.flipHorizontal();

		expect(getPixel(tab, 0, 0)).toEqual(GREEN);
		expect(getPixel(tab, 1, 0)).toEqual(RED);
		expect(notifier.dirtyCalls).toEqual(['doc-test']);

		tab.undo();

		expect(getPixel(tab, 0, 0)).toEqual(RED);
		expect(getPixel(tab, 1, 0)).toEqual(GREEN);
	});

	it('flipHorizontal commits an idle Floating Selection before flipping committed pixels', () => {
		const pixels = new Uint8Array(4 * 1 * 4);
		pixels.set(makePixelRgba(RED), 0);
		pixels.set(makePixelRgba(GREEN), 4);
		const { tab, notifier, shared } = makeTab({
			document: singleLayerDocument(4, 1, pixels),
			canvasWidth: 4,
			canvasHeight: 1
		});
		shared.activeTool = 'selection';
		tab.document.set_marquee(marqueeRegionFromDrag(0, 0, 1, 0));
		tab.nudgeMarquee(1, 0);
		notifier.reset();

		tab.flipHorizontal();

		expect(tab.floatingSelectionOffset).toBeUndefined();
		expect(tab.document.marquee()).toMatchObject({ x: 1, y: 0, width: 2, height: 1 });
		expect(getPixel(tab, 0, 0)).toEqual({ r: 0, g: 0, b: 0, a: 0 });
		expect(getPixel(tab, 1, 0)).toEqual(GREEN);
		expect(getPixel(tab, 2, 0)).toEqual(RED);
		expect(getPixel(tab, 3, 0)).toEqual({ r: 0, g: 0, b: 0, a: 0 });
		expect(notifier.dirtyCalls).toEqual(['doc-test', 'doc-test']);
	});

	it('nudgeMarquee auto-lifts the active Marquee into a one-pixel Floating Selection preview', () => {
		const pixels = new Uint8Array(5 * 5 * 4);
		pixels.set(makePixelRgba(RED), (1 * 5 + 1) * 4);
		pixels.set(makePixelRgba(GREEN), (1 * 5 + 2) * 4);
		const { tab, notifier } = makeTab({
			document: singleLayerDocument(5, 5, pixels)
		});
		tab.document.set_marquee(marqueeRegionFromDrag(1, 1, 2, 1));
		notifier.reset();

		tab.nudgeMarquee(1, 0);

		expect(getPixel(tab, 1, 1)).toEqual({ r: 0, g: 0, b: 0, a: 0 });
		expect(getPixel(tab, 2, 1)).toEqual({ r: 0, g: 0, b: 0, a: 0 });
		expect(getRenderedPixel(tab, 2, 1)).toEqual(RED);
		expect(getRenderedPixel(tab, 3, 1)).toEqual(GREEN);
		expect(tab.document.marquee()).toMatchObject({ x: 1, y: 1, width: 2, height: 1 });
		expect(tab.floatingSelectionOffset).toEqual({ dx: 1, dy: 0 });
		expect(notifier.dirtyCalls).toEqual([]);
	});

	it('nudgeMarquee stacks repeated translations into the same Floating Selection', () => {
		const pixels = new Uint8Array(5 * 5 * 4);
		pixels.set(makePixelRgba(RED), (1 * 5 + 1) * 4);
		pixels.set(makePixelRgba(GREEN), (1 * 5 + 2) * 4);
		const { tab, notifier } = makeTab({
			document: singleLayerDocument(5, 5, pixels)
		});
		tab.document.set_marquee(marqueeRegionFromDrag(1, 1, 2, 1));
		notifier.reset();

		tab.nudgeMarquee(1, 0);
		tab.nudgeMarquee(0, 1);

		expect(tab.floatingSelectionOffset).toEqual({ dx: 1, dy: 1 });
		expect(getRenderedPixel(tab, 2, 2)).toEqual(RED);
		expect(getRenderedPixel(tab, 3, 2)).toEqual(GREEN);
		expect(notifier.dirtyCalls).toEqual([]);
	});

	it('nudgeMarquee is a silent no-op when no Marquee exists', () => {
		const pixels = new Uint8Array(5 * 5 * 4);
		pixels.set(makePixelRgba(RED), (1 * 5 + 1) * 4);
		const { tab, notifier } = makeTab({
			document: singleLayerDocument(5, 5, pixels)
		});
		notifier.reset();
		const beforeRenderVersion = tab.renderVersion;

		tab.nudgeMarquee(1, 0);

		expect(tab.floatingSelectionOffset).toBeUndefined();
		expect(getPixel(tab, 1, 1)).toEqual(RED);
		expect(tab.renderVersion).toBe(beforeRenderVersion);
		expect(notifier.dirtyCalls).toEqual([]);
	});

	it('nudgeMarquee is a silent no-op when a Reference Layer is active', () => {
		const { document } = makeReferenceDocumentWithPlacement({ x: 0, y: 0, scale: 1 });
		const { tab, notifier } = makeTab({ document });
		tab.document.set_marquee(marqueeRegionFromDrag(0, 0, 1, 1));
		notifier.reset();
		const beforeRenderVersion = tab.renderVersion;

		tab.nudgeMarquee(1, 0);

		expect(tab.floatingSelectionOffset).toBeUndefined();
		expect(tab.document.marquee()).toMatchObject({ x: 0, y: 0, width: 2, height: 2 });
		expect(tab.renderVersion).toBe(beforeRenderVersion);
		expect(notifier.dirtyCalls).toEqual([]);
	});

	it('commitFloatingSelection clips an off-canvas Marquee nudge and keeps the commit undoable', () => {
		const pixels = new Uint8Array(3 * 3 * 4);
		pixels.set(makePixelRgba(RED), (1 * 3 + 1) * 4);
		pixels.set(makePixelRgba(GREEN), (1 * 3 + 2) * 4);
		const { tab, notifier } = makeTab({
			document: singleLayerDocument(3, 3, pixels)
		});
		tab.document.set_marquee(marqueeRegionFromDrag(1, 1, 2, 1));
		notifier.reset();

		tab.nudgeMarquee(-2, 0);
		tab.commitFloatingSelection();

		expect(getPixel(tab, 0, 1)).toEqual(GREEN);
		expect(getPixel(tab, 1, 1)).toEqual({ r: 0, g: 0, b: 0, a: 0 });
		expect(getPixel(tab, 2, 1)).toEqual({ r: 0, g: 0, b: 0, a: 0 });
		expect(tab.document.marquee()).toMatchObject({ x: -1, y: 1, width: 2, height: 1 });
		expect(notifier.dirtyCalls).toEqual(['doc-test']);

		tab.undo();

		expect(getPixel(tab, 1, 1)).toEqual(RED);
		expect(getPixel(tab, 2, 1)).toEqual(GREEN);
		expect(tab.document.marquee()).toMatchObject({ x: 1, y: 1, width: 2, height: 1 });
	});

	it('duplicateFloatingSelection commits the current Floating and keeps a duplicate Floating offset for touch movement', () => {
		const pixels = new Uint8Array(5 * 5 * 4);
		pixels.set(makePixelRgba(RED), (1 * 5 + 1) * 4);
		const { tab, notifier } = makeTab({
			document: singleLayerDocument(5, 5, pixels)
		});
		tab.document.set_marquee(marqueeRegionFromDrag(1, 1, 1, 1));
		tab.nudgeMarquee(1, 0);
		notifier.reset();

		tab.duplicateFloatingSelection();

		expect(tab.floatingSelectionOffset).toEqual({ dx: 1, dy: 1 });
		expect(getPixel(tab, 1, 1)).toEqual({ r: 0, g: 0, b: 0, a: 0 });
		expect(getPixel(tab, 2, 1)).toEqual(RED);
		expect(getPixel(tab, 3, 2)).toEqual({ r: 0, g: 0, b: 0, a: 0 });
		expect(getRenderedPixel(tab, 3, 2)).toEqual(RED);
		expect(tab.document.marquee()).toMatchObject({ x: 2, y: 1, width: 1, height: 1 });
		expect(notifier.dirtyCalls).toEqual(['doc-test']);

		tab.commitFloatingSelection();

		expect(tab.floatingSelectionOffset).toBeUndefined();
		expect(getPixel(tab, 2, 1)).toEqual(RED);
		expect(getPixel(tab, 3, 2)).toEqual(RED);
		expect(tab.document.marquee()).toMatchObject({ x: 3, y: 2, width: 1, height: 1 });

		tab.undo();

		expect(getPixel(tab, 2, 1)).toEqual(RED);
		expect(getPixel(tab, 3, 2)).toEqual({ r: 0, g: 0, b: 0, a: 0 });
		expect(tab.document.marquee()).toMatchObject({ x: 2, y: 1, width: 1, height: 1 });
	});

	it('clearMarqueeOrFloating cancels only the duplicate Floating after Duplicate', () => {
		const pixels = new Uint8Array(5 * 5 * 4);
		pixels.set(makePixelRgba(RED), (1 * 5 + 1) * 4);
		const { tab, notifier } = makeTab({
			document: singleLayerDocument(5, 5, pixels)
		});
		tab.document.set_marquee(marqueeRegionFromDrag(1, 1, 1, 1));
		tab.nudgeMarquee(1, 0);
		notifier.reset();

		tab.duplicateFloatingSelection();
		tab.clearMarqueeOrFloating();

		expect(tab.floatingSelectionOffset).toBeUndefined();
		expect(getPixel(tab, 1, 1)).toEqual({ r: 0, g: 0, b: 0, a: 0 });
		expect(getPixel(tab, 2, 1)).toEqual(RED);
		expect(getPixel(tab, 3, 2)).toEqual({ r: 0, g: 0, b: 0, a: 0 });
		expect(tab.document.marquee()).toMatchObject({ x: 2, y: 1, width: 1, height: 1 });
		expect(notifier.dirtyCalls).toEqual(['doc-test']);
	});

	it('keeps a dragged Duplicate Floating cancelable without committing the duplicate', () => {
		const pixels = new Uint8Array(5 * 5 * 4);
		pixels.set(makePixelRgba(RED), (1 * 5 + 1) * 4);
		const { tab, notifier, shared } = makeTab({
			document: singleLayerDocument(5, 5, pixels)
		});
		shared.activeTool = 'selection';
		tab.document.set_marquee(marqueeRegionFromDrag(1, 1, 1, 1));
		tab.nudgeMarquee(1, 0);
		notifier.reset();

		tab.duplicateFloatingSelection();
		expect(tab.floatingSelectionOffset).toEqual({ dx: 1, dy: 1 });

		tab.drawStart(0, 'mouse');
		tab.draw({ x: 3, y: 2 }, null);
		tab.draw({ x: 4, y: 2 }, { x: 3, y: 2 });
		tab.drawEnd();

		expect(tab.floatingSelectionOffset).toEqual({ dx: 2, dy: 1 });
		expect(getPixel(tab, 2, 1)).toEqual(RED);
		expect(getRenderedPixel(tab, 4, 2)).toEqual(RED);
		expect(notifier.dirtyCalls).toEqual(['doc-test']);

		tab.clearMarqueeOrFloating();

		expect(tab.floatingSelectionOffset).toBeUndefined();
		expect(getPixel(tab, 2, 1)).toEqual(RED);
		expect(getPixel(tab, 3, 2)).toEqual({ r: 0, g: 0, b: 0, a: 0 });
		expect(getPixel(tab, 4, 2)).toEqual({ r: 0, g: 0, b: 0, a: 0 });
		expect(tab.document.marquee()).toMatchObject({ x: 2, y: 1, width: 1, height: 1 });
		expect(notifier.dirtyCalls).toEqual(['doc-test']);
	});

	it('commits an idle Floating Selection when the next selection drag starts outside it', () => {
		const pixels = new Uint8Array(5 * 5 * 4);
		pixels.set(makePixelRgba(RED), (1 * 5 + 1) * 4);
		pixels.set(makePixelRgba(GREEN), (1 * 5 + 2) * 4);
		const { tab, notifier, shared } = makeTab({
			document: singleLayerDocument(5, 5, pixels)
		});
		shared.activeTool = 'selection';
		tab.document.set_marquee(marqueeRegionFromDrag(1, 1, 2, 1));
		tab.nudgeMarquee(1, 1);
		notifier.reset();

		tab.drawStart(0, 'mouse');

		expect(tab.floatingSelectionOffset).toEqual({ dx: 1, dy: 1 });
		expect(notifier.dirtyCalls).toEqual([]);

		tab.draw({ x: 0, y: 0 }, null);

		expect(tab.floatingSelectionOffset).toBeUndefined();
		expect(getPixel(tab, 2, 2)).toEqual(RED);
		expect(getPixel(tab, 3, 2)).toEqual(GREEN);
		expect(tab.document.marquee()).toMatchObject({ x: 2, y: 2, width: 2, height: 1 });
		expect(notifier.dirtyCalls).toEqual(['doc-test']);

		tab.drawCancel();
		tab.undo();

		expect(getPixel(tab, 1, 1)).toEqual(RED);
		expect(getPixel(tab, 2, 1)).toEqual(GREEN);
		expect(tab.document.marquee()).toMatchObject({ x: 1, y: 1, width: 2, height: 1 });
	});

	it('keeps outside-drag Selection no-op on Reference-active documents with a Floating Selection', () => {
		const pixelId = crypto.randomUUID();
		const referenceId = crypto.randomUUID();
		const pixels = new Uint8Array(5 * 5 * 4);
		pixels.set(makePixelRgba(RED), (1 * 5 + 1) * 4);
		const { tab, notifier, shared } = makeTab({
			document: documentFromLayerSource({
				width: 5,
				height: 5,
				layers: [
					{
						kind: 'pixel',
						id: pixelId,
						name: 'Paint',
						pixels,
						visible: true,
						opacity: 1
					},
					{
						kind: 'reference',
						id: referenceId,
						name: 'Reference',
						visible: true,
						opacity: 1,
						sourceBlob: new Blob([new Uint8Array([1])], { type: 'image/png' }),
						sourceRgba: makePixelRgba(BLUE),
						naturalWidth: 1,
						naturalHeight: 1,
						placement: { x: 0, y: 0, scale: 1 }
					}
				],
				activeLayerId: pixelId,
				nextLayerNumber: 3,
				timelinePanelCollapsed: false
			})
		});
		shared.activeTool = 'selection';
		tab.document.set_marquee(marqueeRegionFromDrag(1, 1, 1, 1));

		tab.drawStart(0, 'mouse');
		tab.draw({ x: 1, y: 1 }, null);
		tab.draw({ x: 2, y: 1 }, { x: 1, y: 1 });
		tab.setActiveLayer(referenceId);
		tab.drawEnd();
		notifier.reset();

		tab.drawStart(0, 'mouse');
		tab.draw({ x: 0, y: 0 }, null);

		expect(tab.document.active_layer_id()).toBe(referenceId);
		expect(tab.floatingSelectionOffset).toEqual({ dx: 1, dy: 0 });
		const pixelLayerIndex = tab.document.layers_metadata().findIndex((record) => record.id === pixelId);
		expect(pixelLayerIndex).not.toBe(-1);
		const pixelLayerPixels = tab.document.layer_pixels_at(pixelLayerIndex)!;
		expect(getPixelFromBuffer(pixelLayerPixels, 5, 1, 1)).toEqual({
			r: 0,
			g: 0,
			b: 0,
			a: 0
		});
		expect(getPixelFromBuffer(pixelLayerPixels, 5, 2, 1)).toEqual({
			r: 0,
			g: 0,
			b: 0,
			a: 0
		});
		expect(getRenderedPixel(tab, 2, 1)).toEqual(RED);
		expect(notifier.dirtyCalls).toEqual([]);
	});

	it('keeps repeated Floating Selection drags cancelable until explicit commit', () => {
		const pixels = new Uint8Array(5 * 5 * 4);
		pixels.set(makePixelRgba(RED), (1 * 5 + 1) * 4);
		pixels.set(makePixelRgba(GREEN), (1 * 5 + 2) * 4);
		const { tab, notifier, shared } = makeTab({
			document: singleLayerDocument(5, 5, pixels)
		});
		shared.activeTool = 'selection';
		tab.document.set_marquee(marqueeRegionFromDrag(1, 1, 2, 1));
		notifier.reset();

		tab.drawStart(0, 'mouse');
		tab.draw({ x: 1, y: 1 }, null);
		tab.draw({ x: 2, y: 2 }, { x: 1, y: 1 });
		tab.drawEnd();
		expect(tab.floatingSelectionOffset).toEqual({ dx: 1, dy: 1 });

		tab.drawStart(0, 'mouse');
		tab.draw({ x: 2, y: 2 }, null);
		tab.draw({ x: 3, y: 2 }, { x: 2, y: 2 });
		tab.drawEnd();

		expect(tab.floatingSelectionOffset).toEqual({ dx: 2, dy: 1 });
		expect(getRenderedPixel(tab, 3, 2)).toEqual(RED);
		expect(getRenderedPixel(tab, 4, 2)).toEqual(GREEN);
		expect(notifier.dirtyCalls).toEqual([]);

		tab.clearMarqueeOrFloating();

		expect(tab.floatingSelectionOffset).toBeUndefined();
		expect(getPixel(tab, 1, 1)).toEqual(RED);
		expect(getPixel(tab, 2, 1)).toEqual(GREEN);
		expect(getPixel(tab, 3, 2)).toEqual({ r: 0, g: 0, b: 0, a: 0 });
		expect(getPixel(tab, 4, 2)).toEqual({ r: 0, g: 0, b: 0, a: 0 });
		expect(tab.document.marquee()).toMatchObject({ x: 1, y: 1, width: 2, height: 1 });
		expect(notifier.dirtyCalls).toEqual([]);
	});

	it('undo cancels an uncommitted Floating Selection nudge before touching document history', () => {
		const pixels = new Uint8Array(5 * 5 * 4);
		pixels.set(makePixelRgba(RED), (1 * 5 + 1) * 4);
		pixels.set(makePixelRgba(GREEN), (1 * 5 + 2) * 4);
		const { tab, notifier, shared } = makeTab({
			document: singleLayerDocument(5, 5, pixels)
		});
		shared.activeTool = 'selection';

		tab.drawStart(0, 'mouse');
		tab.draw({ x: 1, y: 1 }, null);
		tab.draw({ x: 2, y: 1 }, { x: 1, y: 1 });
		tab.drawEnd();
		tab.nudgeMarquee(1, 1);
		notifier.reset();

		tab.undo();

		expect(tab.floatingSelectionOffset).toBeUndefined();
		expect(getPixel(tab, 1, 1)).toEqual(RED);
		expect(getPixel(tab, 2, 1)).toEqual(GREEN);
		expect(getRenderedPixel(tab, 2, 2)).toEqual({ r: 0, g: 0, b: 0, a: 0 });
		expect(getRenderedPixel(tab, 3, 2)).toEqual({ r: 0, g: 0, b: 0, a: 0 });
		expect(tab.document.marquee()).toMatchObject({ x: 1, y: 1, width: 2, height: 1 });
		expect(notifier.dirtyCalls).toEqual([]);

		tab.undo();

		expect(tab.document.marquee()).toBeUndefined();
	});

	it('clear commits an idle Floating Selection nudge before clearing the active layer', () => {
		const pixels = new Uint8Array(5 * 5 * 4);
		pixels.set(makePixelRgba(RED), (1 * 5 + 1) * 4);
		pixels.set(makePixelRgba(GREEN), (1 * 5 + 2) * 4);
		const { tab, notifier } = makeTab({
			document: singleLayerDocument(5, 5, pixels)
		});
		tab.document.set_marquee(marqueeRegionFromDrag(1, 1, 2, 1));
		tab.nudgeMarquee(1, 1);
		notifier.reset();

		tab.clear();

		expect(tab.floatingSelectionOffset).toBeUndefined();
		expect(getPixel(tab, 1, 1)).toEqual({ r: 0, g: 0, b: 0, a: 0 });
		expect(getPixel(tab, 2, 1)).toEqual({ r: 0, g: 0, b: 0, a: 0 });
		expect(getPixel(tab, 2, 2)).toEqual({ r: 0, g: 0, b: 0, a: 0 });
		expect(getPixel(tab, 3, 2)).toEqual({ r: 0, g: 0, b: 0, a: 0 });
		expect(tab.document.marquee()).toMatchObject({ x: 2, y: 2, width: 2, height: 1 });
		expect(notifier.dirtyCalls).toEqual(['doc-test', 'doc-test']);

		tab.undo();

		expect(getPixel(tab, 2, 2)).toEqual(RED);
		expect(getPixel(tab, 3, 2)).toEqual(GREEN);
		expect(tab.document.marquee()).toMatchObject({ x: 2, y: 2, width: 2, height: 1 });

		tab.undo();

		expect(getPixel(tab, 1, 1)).toEqual(RED);
		expect(getPixel(tab, 2, 1)).toEqual(GREEN);
		expect(getPixel(tab, 2, 2)).toEqual({ r: 0, g: 0, b: 0, a: 0 });
		expect(getPixel(tab, 3, 2)).toEqual({ r: 0, g: 0, b: 0, a: 0 });
		expect(tab.document.marquee()).toMatchObject({ x: 1, y: 1, width: 2, height: 1 });
	});

	it('clearMarqueePixels commits an idle Floating Selection nudge before clearing moved pixels', () => {
		const pixels = new Uint8Array(5 * 5 * 4);
		pixels.set(makePixelRgba(RED), (1 * 5 + 1) * 4);
		pixels.set(makePixelRgba(GREEN), (1 * 5 + 2) * 4);
		const { tab } = makeTab({
			document: singleLayerDocument(5, 5, pixels)
		});
		tab.document.set_marquee(marqueeRegionFromDrag(1, 1, 2, 1));
		tab.nudgeMarquee(1, 1);

		tab.clearMarqueePixels();

		expect(tab.floatingSelectionOffset).toBeUndefined();
		expect(getPixel(tab, 1, 1)).toEqual({ r: 0, g: 0, b: 0, a: 0 });
		expect(getPixel(tab, 2, 1)).toEqual({ r: 0, g: 0, b: 0, a: 0 });
		expect(getPixel(tab, 2, 2)).toEqual({ r: 0, g: 0, b: 0, a: 0 });
		expect(getPixel(tab, 3, 2)).toEqual({ r: 0, g: 0, b: 0, a: 0 });
		expect(tab.document.marquee()).toMatchObject({ x: 2, y: 2, width: 2, height: 1 });

		tab.undo();

		expect(getPixel(tab, 2, 2)).toEqual(RED);
		expect(getPixel(tab, 3, 2)).toEqual(GREEN);
	});

	it('removeLayer commits an idle Floating Selection nudge before deleting the source layer', () => {
		const sourceId = crypto.randomUUID();
		const otherId = crypto.randomUUID();
		const sourcePixels = new Uint8Array(5 * 5 * 4);
		sourcePixels.set(makePixelRgba(RED), (1 * 5 + 1) * 4);
		sourcePixels.set(makePixelRgba(GREEN), (1 * 5 + 2) * 4);
		const { tab } = makeTab({
			document: documentFromLayerSource({
				width: 5,
				height: 5,
				layers: [
					{
						kind: 'pixel',
						id: sourceId,
						name: 'Paint',
						pixels: sourcePixels,
						visible: true,
						opacity: 1
					},
					{
						kind: 'pixel',
						id: otherId,
						name: 'Ink',
						pixels: new Uint8Array(5 * 5 * 4),
						visible: true,
						opacity: 1
					}
				],
				activeLayerId: sourceId,
				nextLayerNumber: 3,
				timelinePanelCollapsed: false
			})
		});
		tab.document.set_marquee(marqueeRegionFromDrag(1, 1, 2, 1));
		tab.nudgeMarquee(1, 1);

		tab.removeLayer(sourceId);

		expect(tab.floatingSelectionOffset).toBeUndefined();
		expect(tab.document.layer_count()).toBe(1);
		expect(tab.document.marquee()).toMatchObject({ x: 2, y: 2, width: 2, height: 1 });

		tab.undo();

		expect(tab.document.layer_count()).toBe(2);
		expect(getPixelFromBuffer(tab.document.layer_pixels_at(0)!, 5, 2, 2)).toEqual(RED);
		expect(getPixelFromBuffer(tab.document.layer_pixels_at(0)!, 5, 3, 2)).toEqual(GREEN);
		expect(tab.document.marquee()).toMatchObject({ x: 2, y: 2, width: 2, height: 1 });

		tab.undo();

		expect(tab.document.layer_count()).toBe(2);
		expect(getPixelFromBuffer(tab.document.layer_pixels_at(0)!, 5, 1, 1)).toEqual(RED);
		expect(getPixelFromBuffer(tab.document.layer_pixels_at(0)!, 5, 2, 1)).toEqual(GREEN);
		expect(getPixelFromBuffer(tab.document.layer_pixels_at(0)!, 5, 2, 2)).toEqual({
			r: 0,
			g: 0,
			b: 0,
			a: 0
		});
		expect(getPixelFromBuffer(tab.document.layer_pixels_at(0)!, 5, 3, 2)).toEqual({
			r: 0,
			g: 0,
			b: 0,
			a: 0
		});
		expect(tab.document.marquee()).toMatchObject({ x: 1, y: 1, width: 2, height: 1 });
	});

	it('dragging inside the Marquee leaves a Floating Selection for explicit commit', () => {
		const pixels = new Uint8Array(5 * 5 * 4);
		pixels.set(makePixelRgba(RED), (1 * 5 + 1) * 4);
		pixels.set(makePixelRgba(GREEN), (1 * 5 + 2) * 4);
		pixels.set(makePixelRgba(BLUE), (2 * 5 + 2) * 4);
		const { tab, notifier, shared } = makeTab({
			document: singleLayerDocument(5, 5, pixels)
		});
		shared.activeTool = 'selection';
		tab.document.set_marquee(marqueeRegionFromDrag(1, 1, 2, 1));
		notifier.reset();
		const beforeDragRenderVersion = tab.renderVersion;

		tab.drawStart(0, 'mouse');
		tab.draw({ x: 1, y: 1 }, null);
		tab.draw({ x: 2, y: 2 }, { x: 1, y: 1 });

		expect(getPixel(tab, 1, 1)).toEqual({ r: 0, g: 0, b: 0, a: 0 });
		expect(getPixel(tab, 2, 1)).toEqual({ r: 0, g: 0, b: 0, a: 0 });
		expect(getPixel(tab, 2, 2)).toEqual(BLUE);
		expect(getRenderedPixel(tab, 2, 2)).toEqual(RED);
		expect(getRenderedPixel(tab, 3, 2)).toEqual(GREEN);
		expect(tab.renderVersion).toBeGreaterThan(beforeDragRenderVersion);
		expect(notifier.dirtyCalls).toEqual([]);

		tab.drawEnd();

		expect(tab.floatingSelectionOffset).toEqual({ dx: 1, dy: 1 });
		expect(getPixel(tab, 2, 2)).toEqual(BLUE);
		expect(getRenderedPixel(tab, 2, 2)).toEqual(RED);
		expect(getRenderedPixel(tab, 3, 2)).toEqual(GREEN);
		expect(notifier.dirtyCalls).toEqual([]);

		tab.commitFloatingSelection();

		expect(getPixel(tab, 2, 2)).toEqual(RED);
		expect(getPixel(tab, 3, 2)).toEqual(GREEN);
		expect(tab.document.marquee()).toMatchObject({ x: 2, y: 2, width: 2, height: 1 });
		expect(notifier.dirtyCalls).toEqual(['doc-test']);

		tab.undo();

		expect(getPixel(tab, 1, 1)).toEqual(RED);
		expect(getPixel(tab, 2, 1)).toEqual(GREEN);
		expect(getPixel(tab, 2, 2)).toEqual(BLUE);
		expect(getPixel(tab, 3, 2)).toEqual({ r: 0, g: 0, b: 0, a: 0 });
		expect(tab.document.marquee()).toMatchObject({ x: 1, y: 1, width: 2, height: 1 });
	});

	it('renders a Floating Selection preview at the source layer stack position', () => {
		const bottomPixels = new Uint8Array(5 * 5 * 4);
		bottomPixels.set(makePixelRgba(RED), (1 * 5 + 1) * 4);
		const topPixels = new Uint8Array(5 * 5 * 4);
		topPixels.set(makePixelRgba(BLUE), (2 * 5 + 2) * 4);
		const bottomId = crypto.randomUUID();
		const topId = crypto.randomUUID();
		const { tab, shared } = makeTab({
			document: documentFromLayerSource({
				width: 5,
				height: 5,
				layers: [
					{
						kind: 'pixel',
						id: bottomId,
						name: 'Paint',
						pixels: bottomPixels,
						visible: true,
						opacity: 1
					},
					{
						kind: 'pixel',
						id: topId,
						name: 'Ink',
						pixels: topPixels,
						visible: true,
						opacity: 1
					}
				],
				activeLayerId: bottomId,
				nextLayerNumber: 3,
				timelinePanelCollapsed: false
			})
		});
		shared.activeTool = 'selection';
		tab.document.set_marquee(marqueeRegionFromDrag(1, 1, 1, 1));

		tab.drawStart(0, 'mouse');
		tab.draw({ x: 1, y: 1 }, null);
		tab.draw({ x: 2, y: 2 }, { x: 1, y: 1 });

		expect(getRenderedPixel(tab, 2, 2)).toEqual(BLUE);

		tab.drawEnd();
		expect(getPixel(tab, 2, 2)).toEqual(BLUE);
	});

	it('keeps Floating Selection preview and commit on the source layer after active layer changes', () => {
		const bottomPixels = new Uint8Array(5 * 5 * 4);
		bottomPixels.set(makePixelRgba(RED), (1 * 5 + 1) * 4);
		const topPixels = new Uint8Array(5 * 5 * 4);
		topPixels.set(makePixelRgba(BLUE), (2 * 5 + 2) * 4);
		const bottomId = crypto.randomUUID();
		const topId = crypto.randomUUID();
		const { tab, shared } = makeTab({
			document: documentFromLayerSource({
				width: 5,
				height: 5,
				layers: [
					{
						kind: 'pixel',
						id: bottomId,
						name: 'Paint',
						pixels: bottomPixels,
						visible: true,
						opacity: 1
					},
					{
						kind: 'pixel',
						id: topId,
						name: 'Ink',
						pixels: topPixels,
						visible: true,
						opacity: 1
					}
				],
				activeLayerId: bottomId,
				nextLayerNumber: 3,
				timelinePanelCollapsed: false
			})
		});
		shared.activeTool = 'selection';
		tab.document.set_marquee(marqueeRegionFromDrag(1, 1, 1, 1));

		tab.drawStart(0, 'mouse');
		tab.draw({ x: 1, y: 1 }, null);
		tab.draw({ x: 2, y: 2 }, { x: 1, y: 1 });
		tab.setActiveLayer(topId);

		expect(getRenderedPixel(tab, 2, 2)).toEqual(BLUE);

		tab.drawEnd();
		tab.commitFloatingSelection();

		expect(tab.document.active_layer_id()).toBe(topId);
		expect(getPixelFromBuffer(tab.document.layer_pixels_at(0)!, 5, 1, 1)).toEqual({
			r: 0,
			g: 0,
			b: 0,
			a: 0
		});
		expect(getPixelFromBuffer(tab.document.layer_pixels_at(0)!, 5, 2, 2)).toEqual(RED);
		expect(getPixelFromBuffer(tab.document.layer_pixels_at(1)!, 5, 2, 2)).toEqual(BLUE);
		expect(tab.document.marquee()).toMatchObject({ x: 2, y: 2, width: 1, height: 1 });
	});

	it('toSnapshot serializes source pixels while a Floating Selection is live', () => {
		const pixels = new Uint8Array(5 * 5 * 4);
		pixels.set(makePixelRgba(RED), (1 * 5 + 1) * 4);
		pixels.set(makePixelRgba(GREEN), (1 * 5 + 2) * 4);
		pixels.set(makePixelRgba(BLUE), (2 * 5 + 2) * 4);
		const { tab, shared } = makeTab({
			document: singleLayerDocument(5, 5, pixels)
		});
		shared.activeTool = 'selection';
		tab.document.set_marquee(marqueeRegionFromDrag(1, 1, 2, 1));

		tab.drawStart(0, 'mouse');
		tab.draw({ x: 1, y: 1 }, null);
		tab.draw({ x: 2, y: 2 }, { x: 1, y: 1 });

		expect(getPixel(tab, 1, 1)).toEqual({ r: 0, g: 0, b: 0, a: 0 });
		expect(getRenderedPixel(tab, 2, 2)).toEqual(RED);

		const snap = tab.toSnapshot();
		const layer = expectPixelLayer(snap.layers[0]);
		expect(getPixelFromBuffer(layer.pixels, snap.width, 1, 1)).toEqual(RED);
		expect(getPixelFromBuffer(layer.pixels, snap.width, 2, 1)).toEqual(GREEN);
		expect(getPixelFromBuffer(layer.pixels, snap.width, 2, 2)).toEqual(BLUE);
		expect(snap.marquee).toEqual({ x: 1, y: 1, width: 2, height: 1 });
	});

	it('drawCancel restores a lifted Floating Selection without marking the tab dirty', () => {
		const pixels = new Uint8Array(5 * 5 * 4);
		pixels.set(makePixelRgba(RED), (1 * 5 + 1) * 4);
		pixels.set(makePixelRgba(GREEN), (1 * 5 + 2) * 4);
		const { tab, notifier, shared } = makeTab({
			document: singleLayerDocument(5, 5, pixels)
		});
		shared.activeTool = 'selection';
		tab.document.set_marquee(marqueeRegionFromDrag(1, 1, 2, 1));
		notifier.reset();

		tab.drawStart(0, 'mouse');
		tab.draw({ x: 1, y: 1 }, null);
		tab.draw({ x: 2, y: 2 }, { x: 1, y: 1 });
		expect(getPixel(tab, 1, 1)).toEqual({ r: 0, g: 0, b: 0, a: 0 });

		tab.drawCancel();

		expect(getPixel(tab, 1, 1)).toEqual(RED);
		expect(getPixel(tab, 2, 1)).toEqual(GREEN);
		expect(tab.document.marquee()).toMatchObject({ x: 1, y: 1, width: 2, height: 1 });
		expect(notifier.dirtyCalls).toEqual([]);
	});

	it('clearMarqueeOrFloating cancels an in-flight Floating Selection instead of committing it', () => {
		const pixels = new Uint8Array(5 * 5 * 4);
		pixels.set(makePixelRgba(RED), (1 * 5 + 1) * 4);
		pixels.set(makePixelRgba(GREEN), (1 * 5 + 2) * 4);
		const { tab, notifier, shared } = makeTab({
			document: singleLayerDocument(5, 5, pixels)
		});
		shared.activeTool = 'selection';
		tab.document.set_marquee(marqueeRegionFromDrag(1, 1, 2, 1));
		notifier.reset();

		tab.drawStart(0, 'mouse');
		tab.draw({ x: 1, y: 1 }, null);
		tab.draw({ x: 2, y: 2 }, { x: 1, y: 1 });
		expect(getPixel(tab, 1, 1)).toEqual({ r: 0, g: 0, b: 0, a: 0 });
		expect(tab.floatingSelectionOffset).toEqual({ dx: 1, dy: 1 });

		tab.clearMarqueeOrFloating();

		expect(getPixel(tab, 1, 1)).toEqual(RED);
		expect(getPixel(tab, 2, 1)).toEqual(GREEN);
		expect(tab.document.marquee()).toMatchObject({ x: 1, y: 1, width: 2, height: 1 });
		expect(tab.floatingSelectionOffset).toBeUndefined();
		expect(tab.isDrawing).toBe(false);
		expect(notifier.dirtyCalls).toEqual([]);
	});

	it('clearMarqueeOrFloating cancels a released Floating Selection instead of committing it', () => {
		const pixels = new Uint8Array(5 * 5 * 4);
		pixels.set(makePixelRgba(RED), (1 * 5 + 1) * 4);
		pixels.set(makePixelRgba(GREEN), (1 * 5 + 2) * 4);
		const { tab, notifier, shared } = makeTab({
			document: singleLayerDocument(5, 5, pixels)
		});
		shared.activeTool = 'selection';
		tab.document.set_marquee(marqueeRegionFromDrag(1, 1, 2, 1));
		notifier.reset();

		tab.drawStart(0, 'mouse');
		tab.draw({ x: 1, y: 1 }, null);
		tab.draw({ x: 2, y: 2 }, { x: 1, y: 1 });
		tab.drawEnd();
		expect(tab.floatingSelectionOffset).toEqual({ dx: 1, dy: 1 });
		expect(tab.isDrawing).toBe(false);

		tab.clearMarqueeOrFloating();

		expect(getPixel(tab, 1, 1)).toEqual(RED);
		expect(getPixel(tab, 2, 1)).toEqual(GREEN);
		expect(getPixel(tab, 2, 2)).toEqual({ r: 0, g: 0, b: 0, a: 0 });
		expect(tab.document.marquee()).toMatchObject({ x: 1, y: 1, width: 2, height: 1 });
		expect(tab.floatingSelectionOffset).toBeUndefined();
		expect(notifier.dirtyCalls).toEqual([]);
	});

	it('drawCancel restores a lifted Floating Selection source layer after active layer changes', () => {
		const bottomPixels = new Uint8Array(5 * 5 * 4);
		bottomPixels.set(makePixelRgba(RED), (1 * 5 + 1) * 4);
		bottomPixels.set(makePixelRgba(GREEN), (1 * 5 + 2) * 4);
		const topPixels = new Uint8Array(5 * 5 * 4);
		topPixels.set(makePixelRgba(BLUE), (2 * 5 + 2) * 4);
		const bottomId = crypto.randomUUID();
		const topId = crypto.randomUUID();
		const { tab, notifier, shared } = makeTab({
			document: documentFromLayerSource({
				width: 5,
				height: 5,
				layers: [
					{
						kind: 'pixel',
						id: bottomId,
						name: 'Paint',
						pixels: bottomPixels,
						visible: true,
						opacity: 1
					},
					{
						kind: 'pixel',
						id: topId,
						name: 'Ink',
						pixels: topPixels,
						visible: true,
						opacity: 1
					}
				],
				activeLayerId: bottomId,
				nextLayerNumber: 3,
				timelinePanelCollapsed: false
			})
		});
		shared.activeTool = 'selection';
		tab.document.set_marquee(marqueeRegionFromDrag(1, 1, 2, 1));
		notifier.reset();

		tab.drawStart(0, 'mouse');
		tab.draw({ x: 1, y: 1 }, null);
		tab.draw({ x: 2, y: 2 }, { x: 1, y: 1 });
		tab.setActiveLayer(topId);
		notifier.reset();

		tab.drawCancel();

		expect(tab.document.active_layer_id()).toBe(topId);
		expect(getPixelFromBuffer(tab.document.layer_pixels_at(0)!, 5, 1, 1)).toEqual(RED);
		expect(getPixelFromBuffer(tab.document.layer_pixels_at(0)!, 5, 2, 1)).toEqual(GREEN);
		expect(getPixelFromBuffer(tab.document.layer_pixels_at(1)!, 5, 2, 2)).toEqual(BLUE);
		expect(tab.document.marquee()).toMatchObject({ x: 1, y: 1, width: 2, height: 1 });
		expect(notifier.dirtyCalls).toEqual([]);
	});

	it('starts the next Marquee move from the committed Floating Selection position', () => {
		const pixels = new Uint8Array(5 * 5 * 4);
		pixels.set(makePixelRgba(RED), (1 * 5 + 1) * 4);
		pixels.set(makePixelRgba(GREEN), (1 * 5 + 2) * 4);
		const { tab, shared } = makeTab({
			document: singleLayerDocument(5, 5, pixels)
		});
		shared.activeTool = 'selection';
		tab.document.set_marquee(marqueeRegionFromDrag(1, 1, 2, 1));

		tab.drawStart(0, 'mouse');
		tab.draw({ x: 1, y: 1 }, null);
		tab.draw({ x: 2, y: 2 }, { x: 1, y: 1 });
		tab.drawEnd();

		tab.drawStart(0, 'mouse');
		tab.draw({ x: 2, y: 2 }, null);
		tab.draw({ x: 3, y: 2 }, { x: 2, y: 2 });
		tab.drawEnd();
		tab.commitFloatingSelection();

		expect(getPixel(tab, 2, 2)).toEqual({ r: 0, g: 0, b: 0, a: 0 });
		expect(getPixel(tab, 3, 2)).toEqual(RED);
		expect(getPixel(tab, 4, 2)).toEqual(GREEN);
		expect(tab.document.marquee()).toMatchObject({ x: 3, y: 2, width: 2, height: 1 });
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

	it('undo after resize swaps the document and bumps renderVersion', () => {
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

	it('touch long-press inside an active Marquee does not start sampling while Selection is active', () => {
		const { tab, shared } = makeTab();
		shared.activeTool = 'selection';
		tab.document.set_marquee(marqueeRegionFromDrag(1, 1, 3, 3));

		expect(tab.sampleStart({ x: 2, y: 2 }, 0, 'touch')).toBe(false);
		expect(tab.samplingSession.isActive).toBe(false);
	});

	it('touch long-press outside an active Marquee still starts sampling while Selection is active', () => {
		const { tab, shared } = makeTab();
		shared.activeTool = 'selection';
		tab.document.set_marquee(marqueeRegionFromDrag(1, 1, 3, 3));

		expect(tab.sampleStart({ x: 5, y: 5 }, 0, 'touch')).toBe(true);
		expect(tab.samplingSession.isActive).toBe(true);
	});

	it('touch long-press with no active Marquee still starts sampling while Selection is active', () => {
		const { tab, shared } = makeTab();
		shared.activeTool = 'selection';

		expect(tab.sampleStart({ x: 2, y: 2 }, 0, 'touch')).toBe(true);
		expect(tab.samplingSession.isActive).toBe(true);
	});

	it('touch long-press inside a Marquee still starts sampling when Selection is not active', () => {
		const { tab, shared } = makeTab();
		shared.activeTool = 'pencil';
		tab.document.set_marquee(marqueeRegionFromDrag(1, 1, 3, 3));

		expect(tab.sampleStart({ x: 2, y: 2 }, 0, 'touch')).toBe(true);
		expect(tab.samplingSession.isActive).toBe(true);
	});

	it('non-touch sampleStart inside a Marquee still starts sampling while Selection is active', () => {
		const { tab, shared } = makeTab();
		shared.activeTool = 'selection';
		tab.document.set_marquee(marqueeRegionFromDrag(1, 1, 3, 3));

		expect(tab.sampleStart({ x: 2, y: 2 }, 0, 'mouse')).toBe(true);
		expect(tab.samplingSession.isActive).toBe(true);
	});

	it('samples the Reference source image when the active layer is Reference', () => {
		const { document } = makeReferenceDocumentWithPlacement({ x: 0, y: 0, scale: 1 });
		const { tab, shared, notifier } = makeTab({ document });
		shared.foregroundColor = BLACK;
		shared.recentColors = [];

		const started = tab.sampleStart({ x: 0, y: 0 }, 0, 'touch');
		tab.sampleUpdate({ x: 0, y: 0 });
		tab.sampleEnd();

		expect(started).toBe(true);
		expect(tab.samplingSession.isActive).toBe(false);
		expect(shared.foregroundColor).toEqual(RED);
		expect(shared.recentColors).toEqual(['#ff0000']);
		expect(notifier.dirtyCalls).toEqual(['doc-test']);
	});

	it('builds the Reference loupe grid in source-image coordinates, not document pixels', () => {
		const { document } = makeReferenceDocumentWithPlacement({ x: 0, y: 0, scale: 2 });
		const { tab } = makeTab({ document });

		tab.sampleStart({ x: 2, y: 0 }, 0, 'touch');

		expect(tab.samplingSession.grid[LOUPE_CENTER_INDEX]).toEqual(GREEN);
		expect(tab.samplingSession.grid[LOUPE_CENTER_INDEX + 1]).toEqual(BLUE);
	});

	it('uses sub-document-pixel targets for Reference source sampling', () => {
		const { document } = makeReferenceDocumentWithPlacement({ x: 0, y: 0, scale: 0.5 });
		const { tab } = makeTab({ document });

		tab.sampleStart({ x: 0.9, y: 0 }, 0, 'touch');

		expect(tab.samplingSession.grid[LOUPE_CENTER_INDEX]).toEqual(GREEN);
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
		const layer = expectPixelLayer(snap.layers[0]);
		expect(layer.name).toBe('Layer 1');
		expect(layer.pixels).toBeInstanceOf(Uint8Array);
		expect(layer.pixels.length).toBe(8 * 8 * 4);
		expect(layer.visible).toBe(true);
		expect(layer.opacity).toBe(1);
		expect(snap.activeLayerId).toBe(layer.id);
		expect(snap.nextLayerNumber).toBe(2);
		expect(snap.timelinePanelCollapsed).toBe(false);
	});

	it('snapshot active-layer pixels reflect the current document after a draw', () => {
		const { tab, shared } = makeTab();
		shared.foregroundColor = BLACK;
		drawLine(tab, { x: 0, y: 0 }, { x: 3, y: 0 });

		const snap = tab.toSnapshot();
		expect(expectPixelLayer(snap.layers[0]).pixels).toEqual(tab.document.layer_pixels_at(0));
		expect(getPixel(tab, 0, 0)).toEqual(BLACK);
	});

	it('serializes every layer with its id, name, visibility, opacity, and pixels', () => {
		const { tab } = makeTab({ canvasWidth: 4, canvasHeight: 4 });
		tab.addLayer('Layer 2');
		tab.addLayer('Layer 3');

		const snap = tab.toSnapshot();

		expect(snap.layers).toHaveLength(3);
		expect(snap.layers.map((l) => l.name)).toEqual(['Layer 1', 'Layer 2', 'Layer 3']);
		const records = tab.document.layers_metadata();
		for (let i = 0; i < snap.layers.length; i++) {
			expect(snap.layers[i].id).toBe(records[i].id);
			expect(snap.layers[i].visible).toBe(records[i].visible);
			expect(snap.layers[i].opacity).toBe(records[i].opacity);
			expect(expectPixelLayer(snap.layers[i]).pixels).toEqual(tab.document.layer_pixels_at(i));
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
		expect(expectPixelLayer(snap.layers[0]).pixels).toEqual(tab.document.layer_pixels_at(0));
	});
});

describe('TabState — export snapshot', () => {
	it('passes a Pixel-only canvas to PNG export when Reference Layers are visible', async () => {
		const exportModule = await import('../export');
		const exportSpy = vi.mocked(exportModule.exportAsPng);
		exportSpy.mockClear();

		const pixelId = crypto.randomUUID();
		const referenceId = crypto.randomUUID();
		const paintedPixels = new Uint8Array([255, 0, 0, 255]);
		const referencePixels = new Uint8Array([0, 255, 0, 255]);
		const sourceBlob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });
		const document = documentFromLayerSource({
			width: 1,
			height: 1,
			layers: [
				{
					kind: 'pixel',
					id: pixelId,
					name: 'Paint',
					pixels: paintedPixels,
					visible: true,
					opacity: 1
				},
				{
					kind: 'reference',
					id: referenceId,
					name: 'Reference',
					visible: true,
					opacity: 1,
					sourceBlob,
					sourceRgba: referencePixels,
					naturalWidth: 1,
					naturalHeight: 1,
					placement: { x: 0, y: 0, scale: 1 }
				}
			],
			activeLayerId: referenceId,
			nextLayerNumber: 2,
			timelinePanelCollapsed: false
		});
		const { tab } = makeTab({ document });

		tab.exportPng();

		expect(exportSpy).toHaveBeenCalledTimes(1);
		const passed = exportSpy.mock.calls[0][0] as { width: number; height: number; pixels(): Uint8Array };
		expect(passed.width).toBe(1);
		expect(passed.height).toBe(1);
		expect(tab.document.composite()).toEqual(paintedPixels);
		expect(passed.pixels()).toEqual(tab.document.composite_for_export());
		expect(passed.pixels()).toEqual(paintedPixels);
	});
});

describe('TabState — Reference underlay render source', () => {
	it('sets a decoded image as the singleton active Reference Layer and preserves its source blob for snapshots', () => {
		const { tab, notifier } = makeTab({ canvasWidth: 8, canvasHeight: 8 });
		const sourceBlob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });
		const sourceRgba = new Uint8Array([
			10, 20, 30, 255,
			40, 50, 60, 255
		]);
		const beforeVersion = tab.renderVersion;
		notifier.reset();

		const referenceId = tab.setReferenceLayer({
			name: 'sketch.png',
			sourceBlob,
			sourceRgba,
			naturalWidth: 2,
			naturalHeight: 1
		});

		expect(tab.document.layer_count()).toBe(2);
		expect(tab.document.layers_metadata()[0].id).toBe(referenceId);
		expect(tab.document.layers_metadata()[0].kind).toBe('reference');
		expect(tab.document.active_layer_id()).toBe(referenceId);
		expect(tab.referenceLayerUnderlay).toMatchObject({
			sourceRgba,
			naturalWidth: 2,
			naturalHeight: 1,
			placement: { x: 3, y: 3.5, scale: 1 },
			opacity: 1
		});
		expect(tab.renderVersion).toBe(beforeVersion + 1);
		expect(notifier.dirtyCalls).toEqual(['doc-test']);

		const referenceLayer = expectReferenceLayer(tab.toSnapshot().layers[0]);
		expect(referenceLayer.name).toBe('sketch.png');
		expect(referenceLayer.sourceBlob).toBe(sourceBlob);
		expect(referenceLayer.sourceRgba).toEqual(sourceRgba);
	});

	it('replaces an existing Reference Layer without appending a second one and resets placement for the new source', () => {
		const { tab } = makeTab({ canvasWidth: 8, canvasHeight: 8 });
		const firstId = tab.setReferenceLayer({
			name: 'first.png',
			sourceBlob: new Blob([new Uint8Array([1])], { type: 'image/png' }),
			sourceRgba: makePixelRgba(RED),
			naturalWidth: 1,
			naturalHeight: 1
		});
		tab.setReferencePlacement(firstId, { x: 2, y: 3, scale: 4 });

		const secondBlob = new Blob([new Uint8Array([2])], { type: 'image/png' });
		const secondId = tab.setReferenceLayer({
			name: 'second.png',
			sourceBlob: secondBlob,
			sourceRgba: new Uint8Array(8 * 8 * 4),
			naturalWidth: 8,
			naturalHeight: 8
		});

		const kinds = tab.document.layers_metadata().map((record) => record.kind);
		expect(kinds).toEqual(['reference', 'pixel']);
		expect(secondId).not.toBe(firstId);
		expect(tab.document.active_layer_id()).toBe(secondId);
		expect(tab.document.layers_metadata()[0].name).toBe('second.png');
		expect(tab.referenceLayerUnderlay?.placement).toEqual({ x: 0, y: 0, scale: 1 });
		expect(expectReferenceLayer(tab.toSnapshot().layers[0]).sourceBlob).toBe(secondBlob);
	});

	it('keeps the old Reference source blob available when replacement is undone', () => {
		const { tab } = makeTab({ canvasWidth: 8, canvasHeight: 8 });
		const firstBlob = new Blob([new Uint8Array([1])], { type: 'image/png' });
		const firstId = tab.setReferenceLayer({
			name: 'first.png',
			sourceBlob: firstBlob,
			sourceRgba: makePixelRgba(RED),
			naturalWidth: 1,
			naturalHeight: 1
		});

		tab.setReferenceLayer({
			name: 'second.png',
			sourceBlob: new Blob([new Uint8Array([2])], { type: 'image/png' }),
			sourceRgba: makePixelRgba(GREEN),
			naturalWidth: 1,
			naturalHeight: 1
		});
		tab.undo();

		expect(tab.document.active_layer_id()).toBe(firstId);
		const referenceLayer = expectReferenceLayer(tab.toSnapshot().layers[0]);
		expect(referenceLayer.name).toBe('first.png');
		expect(referenceLayer.sourceBlob).toBe(firstBlob);
		expect(Array.from(referenceLayer.sourceRgba)).toEqual(Array.from(makePixelRgba(RED)));
	});

	it('exposes visible Reference source data separately from the Pixel-only composite', () => {
		const pixelId = crypto.randomUUID();
		const referenceId = crypto.randomUUID();
		const paintedPixels = new Uint8Array([255, 0, 0, 255]);
		const referencePixels = new Uint8Array([0, 255, 0, 255, 0, 0, 255, 255]);
		const sourceBlob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });
		const document = documentFromLayerSource({
			width: 1,
			height: 1,
			layers: [
				{
					kind: 'pixel',
					id: pixelId,
					name: 'Paint',
					pixels: paintedPixels,
					visible: true,
					opacity: 1
				},
				{
					kind: 'reference',
					id: referenceId,
					name: 'Reference',
					visible: true,
					opacity: 0.5,
					sourceBlob,
					sourceRgba: referencePixels,
					naturalWidth: 2,
					naturalHeight: 1,
					placement: { x: 3, y: 4, scale: 2 }
				}
			],
			activeLayerId: pixelId,
			nextLayerNumber: 2,
			timelinePanelCollapsed: false
		});
		const { tab } = makeTab({ document });

		expect(tab.compositeBuffer.pixels()).toEqual(paintedPixels);
		expect(tab.referenceLayerUnderlay).toEqual({
			sourceKey: expect.stringMatching(`^${referenceId}:`),
			sourceRgba: referencePixels,
			naturalWidth: 2,
			naturalHeight: 1,
			placement: { x: 3, y: 4, scale: 2 },
			opacity: 0.5
		});

		tab.setLayerVisibility(referenceId, false);

		expect(tab.referenceLayerUnderlay).toBeUndefined();
	});

	it('changes the Reference source key when source pixels change under the same layer id', () => {
		const pixelId = crypto.randomUUID();
		const referenceId = crypto.randomUUID();
		const sourceBlob = new Blob([new Uint8Array([1])], { type: 'image/png' });
		const makeDocument = (sourceRgba: Uint8Array) =>
			documentFromLayerSource({
				width: 1,
				height: 1,
				layers: [
					{
						kind: 'pixel',
						id: pixelId,
						name: 'Paint',
						pixels: new Uint8Array([255, 0, 0, 255]),
						visible: true,
						opacity: 1
					},
					{
						kind: 'reference',
						id: referenceId,
						name: 'Reference',
						visible: true,
						opacity: 1,
						sourceBlob,
						sourceRgba,
						naturalWidth: 1,
						naturalHeight: 1,
						placement: { x: 0, y: 0, scale: 1 }
					}
				],
				activeLayerId: referenceId,
				nextLayerNumber: 2,
				timelinePanelCollapsed: false
			});

		const { tab: first } = makeTab({ document: makeDocument(new Uint8Array([0, 255, 0, 255])) });
		const { tab: second } = makeTab({ document: makeDocument(new Uint8Array([0, 0, 255, 255])) });

		expect(first.referenceLayerUnderlay?.sourceKey).not.toBe(second.referenceLayerUnderlay?.sourceKey);
	});

	it('does not recopy the Reference source when the render-facing getter is read again', () => {
		const pixelId = crypto.randomUUID();
		const referenceId = crypto.randomUUID();
		const document = documentFromLayerSource({
			width: 1,
			height: 1,
			layers: [
				{
					kind: 'pixel',
					id: pixelId,
					name: 'Paint',
					pixels: new Uint8Array([255, 0, 0, 255]),
					visible: true,
					opacity: 1
				},
				{
					kind: 'reference',
					id: referenceId,
					name: 'Reference',
					visible: true,
					opacity: 1,
					sourceBlob: new Blob([new Uint8Array([1])], { type: 'image/png' }),
					sourceRgba: new Uint8Array([0, 255, 0, 255]),
					naturalWidth: 1,
					naturalHeight: 1,
					placement: { x: 0, y: 0, scale: 1 }
				}
			],
			activeLayerId: referenceId,
			nextLayerNumber: 2,
			timelinePanelCollapsed: false
		});
		const { tab } = makeTab({ document });
		const sourceSpy = vi.spyOn(tab.document, 'layer_source_pixels_at');

		const first = tab.referenceLayerUnderlay;
		const second = tab.referenceLayerUnderlay;

		expect(sourceSpy).toHaveBeenCalledOnce();
		expect(second?.sourceKey).toBe(first?.sourceKey);
		expect(second?.sourceRgba).toBe(first?.sourceRgba);
	});

	it('reuses the Document Layer Projection within the same render version', () => {
		const pixelId = crypto.randomUUID();
		const referenceId = crypto.randomUUID();
		const document = documentFromLayerSource({
			width: 1,
			height: 1,
			layers: [
				{
					kind: 'pixel',
					id: pixelId,
					name: 'Paint',
					pixels: new Uint8Array([255, 0, 0, 255]),
					visible: true,
					opacity: 1
				},
				{
					kind: 'reference',
					id: referenceId,
					name: 'Reference',
					visible: true,
					opacity: 1,
					sourceBlob: new Blob([new Uint8Array([1])], { type: 'image/png' }),
					sourceRgba: new Uint8Array([0, 255, 0, 255]),
					naturalWidth: 1,
					naturalHeight: 1,
					placement: { x: 0, y: 0, scale: 1 }
				}
			],
			activeLayerId: referenceId,
			nextLayerNumber: 2,
			timelinePanelCollapsed: false
		});
		const { tab } = makeTab({ document });
		const layerCountSpy = vi.spyOn(tab.document, 'layer_count');

		const first = tab.layerProjection;
		const callCountAfterFirstRead = layerCountSpy.mock.calls.length;
		const second = tab.layerProjection;

		expect(second).toBe(first);
		expect(layerCountSpy.mock.calls).toHaveLength(callCountAfterFirstRead);
	});

	it('updates renderVersion and dirty state when committing Reference placement', () => {
		const pixelId = crypto.randomUUID();
		const referenceId = crypto.randomUUID();
		const document = documentFromLayerSource({
			width: 1,
			height: 1,
			layers: [
				{
					kind: 'pixel',
					id: pixelId,
					name: 'Paint',
					pixels: new Uint8Array([255, 0, 0, 255]),
					visible: true,
					opacity: 1
				},
				{
					kind: 'reference',
					id: referenceId,
					name: 'Reference',
					visible: true,
					opacity: 1,
					sourceBlob: new Blob([new Uint8Array([1])], { type: 'image/png' }),
					sourceRgba: new Uint8Array([0, 255, 0, 255]),
					naturalWidth: 1,
					naturalHeight: 1,
					placement: { x: 0, y: 0, scale: 1 }
				}
			],
			activeLayerId: referenceId,
			nextLayerNumber: 2,
			timelinePanelCollapsed: false
		});
		const { tab, notifier } = makeTab({ document });
		const beforeVersion = tab.renderVersion;

		tab.setReferencePlacement(referenceId, { x: 2, y: 3, scale: 4 });

		expect(tab.referenceLayerUnderlay?.placement).toEqual({ x: 2, y: 3, scale: 4 });
		expect(tab.renderVersion).toBe(beforeVersion + 1);
		expect(notifier.dirtyCalls).toEqual(['doc-test']);
	});

	it('commits each Reference placement change as a separate undo step', () => {
		const { document, referenceId } = makeReferenceDocumentWithPlacement({
			x: 0,
			y: 0,
			scale: 1
		});
		const { tab } = makeTab({ document });

		tab.setReferencePlacement(referenceId, { x: 1, y: 0, scale: 1 });
		tab.setReferencePlacement(referenceId, { x: 2, y: 0, scale: 1 });

		tab.undo();
		expect(tab.referenceLayerUnderlay?.placement).toEqual({ x: 1, y: 0, scale: 1 });

		tab.undo();
		expect(tab.referenceLayerUnderlay?.placement).toEqual({ x: 0, y: 0, scale: 1 });
	});

	it('supplies the active Reference footprint, expanding pan reach beyond the canvas', () => {
		const { document } = makeReferenceDocumentWithPlacement({
			x: 30,
			y: 0,
			scale: 20
		});
		const { tab } = makeTab({ document });
		const requested = { ...tab.viewport, panX: -9999, panY: -9999 };

		tab.setViewport(requested);

		// The active Reference footprint extends the reachable region past the
		// canvas-only clamp. The detailed bounds math is covered by the
		// navigation-bounds and tab-viewport tests; here we only assert that
		// TabState feeds the footprint through to the viewport's clamp.
		const canvasOnly = wasmBackend.viewportOps.clampPan(
			requested,
			tab.document.width,
			tab.document.height,
			tab.viewportSize.width,
			tab.viewportSize.height
		);
		expect(tab.viewport.panX).toBeLessThan(canvasOnly.panX);
		expect(tab.viewport.panY).toBeLessThan(canvasOnly.panY);
	});

	it('reclamps viewport pan to the canvas when leaving the Reference Layer', () => {
		const { document, referenceId } = makeReferenceDocumentWithPlacement({
			x: 30,
			y: 0,
			scale: 20
		});
		const { tab } = makeTab({ document });
		const pixelId = tab.document.layers_metadata().find((layer) => layer.kind === 'pixel')!.id;
		expect(tab.document.active_layer_id()).toBe(referenceId);

		tab.setViewport({ ...tab.viewport, panX: -9999, panY: -9999 });
		expect(tab.viewport.panX).toBeLessThan(0);

		tab.setActiveLayer(pixelId);

		expect(tab.viewport.panX).toBe(0);
		expect(tab.viewport.panY).toBe(0);
	});

	it('fits a Reference Layer to the canvas while preserving source aspect ratio', () => {
		const { document, referenceId } = makeReferenceDocumentWithPlacement({
			x: 5,
			y: 6,
			scale: 3
		});
		const { tab, notifier } = makeTab({ document });
		const beforeVersion = tab.renderVersion;
		notifier.reset();

		tab.fitReferenceLayerToCanvas(referenceId);

		expect(tab.referenceLayerUnderlay?.placement).toEqual({ x: 0, y: 5, scale: 5 });
		expect(tab.renderVersion).toBe(beforeVersion + 1);
		expect(notifier.dirtyCalls).toEqual(['doc-test']);
	});

	it('fitting a Reference Layer to canvas is undoable and redoable', () => {
		const { document, referenceId } = makeReferenceDocumentWithPlacement({
			x: 5,
			y: 6,
			scale: 3
		});
		const { tab } = makeTab({ document });

		tab.fitReferenceLayerToCanvas(referenceId);
		expect(tab.referenceLayerUnderlay?.placement).toEqual({ x: 0, y: 5, scale: 5 });

		tab.undo();
		expect(tab.referenceLayerUnderlay?.placement).toEqual({ x: 5, y: 6, scale: 3 });

		tab.redo();
		expect(tab.referenceLayerUnderlay?.placement).toEqual({ x: 0, y: 5, scale: 5 });
	});

	it('fits to the current canvas dimensions after resize', () => {
		const { document, referenceId } = makeReferenceDocumentWithPlacement({
			x: 5,
			y: 6,
			scale: 3
		});
		const { tab } = makeTab({ document });
		tab.resizeAnchor = 'center';

		tab.resize(24, 30);
		tab.fitReferenceLayerToCanvas(referenceId);

		expect(tab.referenceLayerUnderlay?.placement).toEqual({ x: 0, y: 9, scale: 6 });
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

	it('ignores undo while a draw stroke is active', () => {
		const { tab, shared } = makeTab();
		drawLine(tab, { x: 0, y: 0 }, { x: 3, y: 0 });
		shared.activeTool = 'pencil';
		tab.drawStart(0, 'mouse');
		tab.draw({ x: 5, y: 5 }, null);

		tab.undo();

		expect(getPixel(tab, 5, 5)).toEqual(BLACK);
		tab.drawEnd();
	});

	it('ignores redo while a draw stroke is active', () => {
		const { tab, shared } = makeTab();
		const beforePixels = tab.document.composite();
		drawLine(tab, { x: 0, y: 0 }, { x: 3, y: 0 });
		tab.undo();
		expect(tab.document.composite()).toEqual(beforePixels);

		shared.activeTool = 'selection';
		tab.drawStart(0, 'mouse');
		tab.draw({ x: 1, y: 1 }, null);
		tab.draw({ x: 2, y: 2 }, { x: 1, y: 1 });
		tab.redo();

		expect(tab.document.composite()).toEqual(beforePixels);
		tab.drawCancel();
	});

	it('ignores clear while a draw stroke is active', () => {
		const { tab, shared } = makeTab();
		shared.foregroundColor = BLACK;
		shared.activeTool = 'pencil';
		tab.drawStart(0, 'mouse');
		tab.draw({ x: 5, y: 5 }, null);

		tab.clear();

		expect(getPixel(tab, 5, 5)).toEqual(BLACK);
		tab.drawEnd();
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
		expect(tab.document.layers_metadata()[newIndex].name).toBe('레이어 2');
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
		const layer1Id = tab.document.layers_metadata()[0].id;
		const before = tab.document.layer_count();

		tab.removeLayer(layer1Id);

		expect(tab.document.layer_count()).toBe(before - 1);
	});

	it('reassigns the active pointer to an adjacent layer when the active layer is removed', () => {
		const { tab } = makeTab();
		tab.addLayer('Layer 2');
		const activeId = tab.document.active_layer_id();
		const otherId = tab.document.layers_metadata()[0].id;
		expect(activeId).not.toBe(otherId);

		tab.removeLayer(activeId);

		expect(tab.document.active_layer_id()).toBe(otherId);
	});

	it('leaves the active pointer unchanged when a non-active layer is removed', () => {
		const { tab } = makeTab();
		tab.addLayer('Layer 2');
		const activeId = tab.document.active_layer_id();
		const otherId = tab.document.layers_metadata()[0].id;

		tab.removeLayer(otherId);

		expect(tab.document.active_layer_id()).toBe(activeId);
	});

	it('is undoable: undo restores the prior layer count and active layer', () => {
		const { tab } = makeTab();
		tab.addLayer('Layer 2');
		const beforeCount = tab.document.layer_count();
		const beforeActive = tab.document.active_layer_id();
		const otherId = tab.document.layers_metadata()[0].id;

		tab.removeLayer(otherId);
		expect(tab.document.layer_count()).toBe(beforeCount - 1);

		tab.undo();

		expect(tab.document.layer_count()).toBe(beforeCount);
		expect(tab.document.active_layer_id()).toBe(beforeActive);
	});

	it('keeps a Reference Layer source blob available when removing it is undone', () => {
		const pixelId = crypto.randomUUID();
		const referenceId = crypto.randomUUID();
		const sourceBlob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });
		const sourceRgba = new Uint8Array([
			10, 20, 30, 255,
			40, 50, 60, 255
		]);
		const document = documentFromLayerSource({
			width: 2,
			height: 1,
			layers: [
				{
					kind: 'pixel',
					id: pixelId,
					name: 'Paint',
					pixels: new Uint8Array(2 * 1 * 4),
					visible: true,
					opacity: 1
				},
				{
					kind: 'reference',
					id: referenceId,
					name: 'Reference',
					visible: true,
					opacity: 1,
					sourceBlob,
					sourceRgba,
					naturalWidth: 2,
					naturalHeight: 1,
					placement: { x: 0, y: 0, scale: 1 }
				}
			],
			activeLayerId: referenceId,
			nextLayerNumber: 2,
			timelinePanelCollapsed: false
		});
		const { tab } = makeTab({
			document,
			referenceLayerBlobs: new Map([[referenceId, sourceBlob]])
		});

		tab.removeLayer(referenceId);
		tab.undo();

		const snapshot = tab.toSnapshot();
		const referenceLayer = expectReferenceLayer(snapshot.layers[0]);
		expect(referenceLayer.sourceBlob).toBe(sourceBlob);
		expect(Array.from(referenceLayer.sourceRgba)).toEqual(Array.from(sourceRgba));
	});

	it('bumps renderVersion and emits markDirty', () => {
		const { tab, notifier } = makeTab();
		tab.addLayer('Layer 2');
		const otherId = tab.document.layers_metadata()[0].id;
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
		const layer1Id = tab.document.layers_metadata()[0].id;
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
		const layer1Id = tab.document.layers_metadata()[0].id;
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
		const layer1Id = tab.document.layers_metadata()[0].id;
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

describe('TabState — mixed Pixel and Reference Layer stack operations', () => {
	it('supports activating, reordering, hiding, and deleting a Reference Layer through the same public calls', () => {
		const bottomId = crypto.randomUUID();
		const referenceId = crypto.randomUUID();
		const document = documentFromLayerSource({
			width: 1,
			height: 1,
			layers: [
				{
					kind: 'pixel',
					id: bottomId,
					name: 'Bottom paint',
					pixels: makePixelRgba(BLUE),
					visible: true,
					opacity: 1
				}
			],
			activeLayerId: bottomId,
			nextLayerNumber: 2,
			timelinePanelCollapsed: false
		});
		const { tab, shared } = makeTab({ document });

		tab.document.add_reference_layer(referenceId, 'Sketch reference', makePixelRgba(RED), 1, 1);
		tab.setActiveLayer(bottomId);
		tab.addLayer('Top paint');
		const topId = tab.document.active_layer_id();
		expect([
			tab.document.layers_metadata()[0].kind,
			tab.document.layers_metadata()[1].kind,
			tab.document.layers_metadata()[2].kind
		]).toEqual(['reference', 'pixel', 'pixel']);
		shared.foregroundColor = GREEN;
		shared.activeTool = 'pencil';
		tab.drawStart(0, 'mouse');
		tab.draw({ x: 0, y: 0 }, null);
		tab.drawEnd();

		tab.setActiveLayer(referenceId);
		expect(tab.document.active_layer_id()).toBe(referenceId);

		tab.reorderLayer(referenceId, 0);
		expect(tab.document.layers_metadata()[0].id).toBe(referenceId);
		expect(getPixel(tab, 0, 0)).toEqual(GREEN);

		tab.setLayerVisibility(referenceId, false);
		expect(tab.document.layers_metadata()[0].visible).toBe(false);
		expect(getPixel(tab, 0, 0)).toEqual(GREEN);

		tab.removeLayer(referenceId);
		const remainingIds = tab.document.layers_metadata().map((record) => record.id);
		expect(remainingIds).toEqual([bottomId, topId]);
		expect(tab.document.active_layer_id()).toBe(bottomId);
		expect(getPixel(tab, 0, 0)).toEqual(GREEN);
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
		const layer3Id = tab.document.layers_metadata()[2].id;

		tab.reorderLayer(layer3Id, 2); // move Layer 3 to the panel's bottom row

		// Now expected stack: [Layer 3, Layer 1, Layer 2]
		expect(tab.document.layers_metadata()[0].id).toBe(layer3Id);
	});

	it('moving the bottom-of-panel layer (visual layers-1) to the top (visual 0) puts it at stack index layers-1', () => {
		const { tab } = makeTab();
		tab.addLayer('Layer 2');
		tab.addLayer('Layer 3');
		const layer1Id = tab.document.layers_metadata()[0].id;

		tab.reorderLayer(layer1Id, 0); // move Layer 1 (panel bottom) to the panel's top row

		const top = tab.document.layer_count() - 1;
		expect(tab.document.layers_metadata()[top].id).toBe(layer1Id);
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
		const layer1Id = tab.document.layers_metadata()[0].id;
		const layer2Id = tab.document.layers_metadata()[1].id;
		const layer3Id = tab.document.layers_metadata()[2].id;

		tab.reorderLayer(layer3Id, 2); // [Layer 3, Layer 1, Layer 2]
		expect([
			tab.document.layers_metadata()[0].id,
			tab.document.layers_metadata()[1].id,
			tab.document.layers_metadata()[2].id
		]).toEqual([layer3Id, layer1Id, layer2Id]);

		tab.undo();

		expect([
			tab.document.layers_metadata()[0].id,
			tab.document.layers_metadata()[1].id,
			tab.document.layers_metadata()[2].id
		]).toEqual([layer1Id, layer2Id, layer3Id]);
	});

	it('bumps renderVersion and emits markDirty', () => {
		const { tab, notifier } = makeTab();
		tab.addLayer('Layer 2');
		const layer1Id = tab.document.layers_metadata()[0].id;
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

		expect(tab.document.layers_metadata()[0].visible).toBe(false);
	});

	it('restores Layer.visible to true from a hidden state', () => {
		const { tab } = makeTab();
		const layerId = tab.document.active_layer_id();
		tab.setLayerVisibility(layerId, false);
		expect(tab.document.layers_metadata()[0].visible).toBe(false);

		tab.setLayerVisibility(layerId, true);

		expect(tab.document.layers_metadata()[0].visible).toBe(true);
	});

	it('affects only the targeted layer; sibling layers retain their visibility', () => {
		const { tab } = makeTab();
		tab.addLayer('Layer 2');
		const layer1Id = tab.document.layers_metadata()[0].id;
		const layer2Id = tab.document.layers_metadata()[1].id;

		tab.setLayerVisibility(layer1Id, false);

		expect(tab.document.layers_metadata()[0].visible).toBe(false);
		expect(tab.document.layers_metadata()[1].visible).toBe(true);
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
		expect(tab.document.layers_metadata()[0].visible).toBe(true);

		tab.setLayerVisibility(layerId, false);
		expect(tab.document.layers_metadata()[0].visible).toBe(false);

		tab.undo();

		expect(tab.document.layers_metadata()[0].visible).toBe(true);
	});

	it('is a no-op when called with the current visibility (no renderVersion bump, no markDirty)', () => {
		const { tab, notifier } = makeTab();
		const layerId = tab.document.active_layer_id();
		expect(tab.document.layers_metadata()[0].visible).toBe(true);
		const renderBefore = tab.renderVersion;
		notifier.reset();

		tab.setLayerVisibility(layerId, true);

		expect(tab.document.layers_metadata()[0].visible).toBe(true);
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

describe('TabState — setTimelinePanelCollapsed', () => {
	it('writes the new value to the document', () => {
		const { tab } = makeTab();
		expect(tab.document.is_timeline_panel_collapsed()).toBe(false);

		tab.setTimelinePanelCollapsed(true);
		expect(tab.document.is_timeline_panel_collapsed()).toBe(true);

		tab.setTimelinePanelCollapsed(false);
		expect(tab.document.is_timeline_panel_collapsed()).toBe(false);
	});

	it('emits markDirty so the new value reaches the persistence layer', () => {
		const { tab, notifier } = makeTab();
		notifier.reset();

		tab.setTimelinePanelCollapsed(true);

		expect(notifier.dirtyCalls).toContain('doc-test');
	});

	it('bumps renderVersion so derived UI state reacts to the change', () => {
		const { tab } = makeTab();
		const before = tab.renderVersion;

		tab.setTimelinePanelCollapsed(true);

		expect(tab.renderVersion).toBeGreaterThan(before);
	});

	it('is a no-op when called with the current value (no markDirty, no renderVersion bump)', () => {
		const { tab, notifier } = makeTab();
		expect(tab.document.is_timeline_panel_collapsed()).toBe(false);
		const renderBefore = tab.renderVersion;
		notifier.reset();

		tab.setTimelinePanelCollapsed(false);

		expect(tab.renderVersion).toBe(renderBefore);
		expect(notifier.dirtyCalls).toEqual([]);
	});

	it('is not undoable: a prior content op remains the undo target after toggling', () => {
		const { tab, shared } = makeTab();
		shared.foregroundColor = BLACK;
		shared.activeTool = 'pencil';
		tab.drawStart(0, 'mouse');
		tab.draw({ x: 2, y: 2 }, null);
		tab.drawEnd();
		expect(getPixel(tab, 2, 2).a).toBe(255);

		tab.setTimelinePanelCollapsed(true);
		tab.setTimelinePanelCollapsed(false);

		// One undo reverts the pencil stroke (no orphan snapshot pushed by toggles).
		tab.undo();
		expect(getPixel(tab, 2, 2).a).toBe(0);
	});

	it('does not commit an idle Floating Selection nudge when toggling panel state', () => {
		const pixels = new Uint8Array(5 * 5 * 4);
		pixels.set(makePixelRgba(RED), (1 * 5 + 1) * 4);
		const { tab } = makeTab({
			document: singleLayerDocument(5, 5, pixels)
		});
		tab.document.set_marquee(marqueeRegionFromDrag(1, 1, 1, 1));
		tab.nudgeMarquee(1, 1);

		tab.setTimelinePanelCollapsed(true);

		expect(tab.floatingSelectionOffset).toEqual({ dx: 1, dy: 1 });
		expect(getPixel(tab, 1, 1)).toEqual({ r: 0, g: 0, b: 0, a: 0 });
		expect(getRenderedPixel(tab, 2, 2)).toEqual(RED);

		tab.undo();

		expect(tab.document.is_timeline_panel_collapsed()).toBe(true);
		expect(tab.floatingSelectionOffset).toBeUndefined();
		expect(getPixel(tab, 1, 1)).toEqual(RED);
	});

	it('is reflected in toSnapshot', () => {
		const { tab } = makeTab();
		tab.setTimelinePanelCollapsed(true);

		const snap = tab.toSnapshot();

		expect(snap.timelinePanelCollapsed).toBe(true);
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
