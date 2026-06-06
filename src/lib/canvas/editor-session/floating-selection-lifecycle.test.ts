// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import type { Color } from '../color';
import type { Document } from '../canvas-model';
import { marqueeRegionFromDrag, singleLayerDocument } from '../wasm-backend';
import {
	FloatingSelectionLifecycle,
	type CommitFloatingSelectionIntent
} from './floating-selection-lifecycle';

const RED: Color = { r: 255, g: 0, b: 0, a: 255 };
const GREEN: Color = { r: 0, g: 255, b: 0, a: 255 };
const BLUE: Color = { r: 0, g: 0, b: 255, a: 255 };
const TRANSPARENT: Color = { r: 0, g: 0, b: 0, a: 0 };

function makePixelRgba(color: Color): Uint8Array {
	return new Uint8Array([color.r, color.g, color.b, color.a]);
}

function setPixel(pixels: Uint8Array, width: number, x: number, y: number, color: Color): void {
	pixels.set(makePixelRgba(color), (y * width + x) * 4);
}

function pixelFromBuffer(pixels: Uint8Array, width: number, x: number, y: number): Color {
	const i = (y * width + x) * 4;
	return { r: pixels[i], g: pixels[i + 1], b: pixels[i + 2], a: pixels[i + 3] };
}

function pixelAt(document: Document, x: number, y: number): Color {
	return pixelFromBuffer(document.composite(), document.width, x, y);
}

function previewPixelAt(lifecycle: FloatingSelectionLifecycle, width: number, x: number, y: number): Color {
	return pixelFromBuffer(lifecycle.previewPixels(), width, x, y);
}

function withActiveLayer<T>(document: Document, layerId: string, run: () => T): T {
	const previous = document.active_layer_id();
	if (previous !== layerId) document.set_active_layer(layerId);
	try {
		return run();
	} finally {
		if (document.active_layer_id() !== previous) document.set_active_layer(previous);
	}
}

function applyCommitToDocument(document: Document, intent: CommitFloatingSelectionIntent): void {
	const destRegion = intent.sourceRegion.translate(intent.destOffset.dx, intent.destOffset.dy);
	withActiveLayer(document, intent.sourceLayerId, () => {
		if (intent.clearSourceRegion ?? true) {
			document.set_marquee(intent.sourceRegion.translate(0, 0));
			document.clear_marquee_pixels();
		}
		document.composite_buffer_at(intent.buffer, destRegion);
		document.set_marquee(destRegion);
	});
}

function createLifecycle(document: Document) {
	const commits: CommitFloatingSelectionIntent[] = [];
	const lifecycle = new FloatingSelectionLifecycle({
		getDocument: () => document,
		applyCommit: (intent) => {
			commits.push(intent);
			applyCommitToDocument(document, intent);
		}
	});
	return { lifecycle, commits };
}

describe('FloatingSelectionLifecycle', () => {
	it('auto-lifts and nudges the active Marquee as one lifecycle policy', () => {
		const pixels = new Uint8Array(5 * 5 * 4);
		setPixel(pixels, 5, 1, 1, RED);
		setPixel(pixels, 5, 2, 1, GREEN);
		const document = singleLayerDocument(5, 5, pixels);
		const { lifecycle, commits } = createLifecycle(document);
		document.set_marquee(marqueeRegionFromDrag(1, 1, 2, 1));

		expect(lifecycle.nudgeMarquee({ dx: 1, dy: 0 })).toBe(true);

		expect(commits).toEqual([]);
		expect(pixelAt(document, 1, 1)).toEqual(TRANSPARENT);
		expect(pixelAt(document, 2, 1)).toEqual(TRANSPARENT);
		expect(previewPixelAt(lifecycle, 5, 2, 1)).toEqual(RED);
		expect(previewPixelAt(lifecycle, 5, 3, 1)).toEqual(GREEN);
		expect(lifecycle.offset).toEqual({ dx: 1, dy: 0 });
	});

	it('commits an existing Floating Selection before materializing paste', () => {
		const pixels = new Uint8Array(5 * 5 * 4);
		setPixel(pixels, 5, 1, 1, RED);
		const document = singleLayerDocument(5, 5, pixels);
		const { lifecycle, commits } = createLifecycle(document);
		document.set_marquee(marqueeRegionFromDrag(1, 1, 1, 1));
		lifecycle.nudgeMarquee({ dx: 1, dy: 0 });

		expect(
			lifecycle.pasteClipboard(
				{ pixels: makePixelRgba(BLUE), width: 1, height: 1 },
				marqueeRegionFromDrag(0, 0, 0, 0)
			)
		).toBe(true);

		expect(commits).toHaveLength(1);
		expect(pixelAt(document, 1, 1)).toEqual(TRANSPARENT);
		expect(pixelAt(document, 2, 1)).toEqual(RED);
		expect(previewPixelAt(lifecycle, 5, 0, 0)).toEqual(BLUE);
		expect(document.marquee()).toMatchObject({ x: 0, y: 0, width: 1, height: 1 });
		expect(lifecycle.offset).toEqual({ dx: 0, dy: 0 });
	});

	it('duplicates by committing the current Floating Selection and starting a duplicate preview', () => {
		const pixels = new Uint8Array(5 * 5 * 4);
		setPixel(pixels, 5, 1, 1, RED);
		const document = singleLayerDocument(5, 5, pixels);
		const { lifecycle, commits } = createLifecycle(document);
		document.set_marquee(marqueeRegionFromDrag(1, 1, 1, 1));
		lifecycle.nudgeMarquee({ dx: 1, dy: 0 });

		expect(lifecycle.duplicate()).toBe(true);

		expect(commits).toHaveLength(1);
		expect(pixelAt(document, 1, 1)).toEqual(TRANSPARENT);
		expect(pixelAt(document, 2, 1)).toEqual(RED);
		expect(previewPixelAt(lifecycle, 5, 3, 2)).toEqual(RED);
		expect(document.marquee()).toMatchObject({ x: 2, y: 1, width: 1, height: 1 });
		expect(lifecycle.offset).toEqual({ dx: 1, dy: 1 });
	});

	it('commits idle Floating Selection before a non-Selection draw starts', () => {
		const pixels = new Uint8Array(5 * 5 * 4);
		setPixel(pixels, 5, 1, 1, RED);
		const document = singleLayerDocument(5, 5, pixels);
		const { lifecycle, commits } = createLifecycle(document);
		document.set_marquee(marqueeRegionFromDrag(1, 1, 1, 1));
		lifecycle.nudgeMarquee({ dx: 1, dy: 0 });

		const value = lifecycle.withDrawStartPolicy(false, () => 'started');

		expect(value).toBe('started');
		expect(commits).toHaveLength(1);
		expect(lifecycle.isActive).toBe(false);
		expect(pixelAt(document, 2, 1)).toEqual(RED);
		expect(document.marquee()).toMatchObject({ x: 2, y: 1, width: 1, height: 1 });
	});

	it('projects the moved Marquee only during a Selection draw start', () => {
		const pixels = new Uint8Array(5 * 5 * 4);
		setPixel(pixels, 5, 1, 1, RED);
		const document = singleLayerDocument(5, 5, pixels);
		const { lifecycle, commits } = createLifecycle(document);
		document.set_marquee(marqueeRegionFromDrag(1, 1, 1, 1));
		lifecycle.nudgeMarquee({ dx: 1, dy: 0 });

		lifecycle.withDrawStartPolicy(true, () => {
			expect(document.marquee()).toMatchObject({ x: 2, y: 1, width: 1, height: 1 });
		});

		expect(commits).toEqual([]);
		expect(document.marquee()).toMatchObject({ x: 1, y: 1, width: 1, height: 1 });
		expect(lifecycle.isActive).toBe(true);
	});

	it('commits when the next Selection drag starts outside the projected Floating Selection', () => {
		const pixels = new Uint8Array(5 * 5 * 4);
		setPixel(pixels, 5, 1, 1, RED);
		const document = singleLayerDocument(5, 5, pixels);
		const { lifecycle, commits } = createLifecycle(document);
		document.set_marquee(marqueeRegionFromDrag(1, 1, 1, 1));
		lifecycle.nudgeMarquee({ dx: 1, dy: 0 });
		lifecycle.withDrawStartPolicy(true, () => undefined);

		expect(lifecycle.commitIfSelectionDragStartsOutside({ x: 0, y: 0 }, null)).toBe(true);

		expect(commits).toHaveLength(1);
		expect(lifecycle.isActive).toBe(false);
		expect(pixelAt(document, 2, 1)).toEqual(RED);
		expect(document.marquee()).toMatchObject({ x: 2, y: 1, width: 1, height: 1 });
	});
});
