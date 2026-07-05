// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { viewportOps } from '../wasm-backend';
import { createFakeDirtyNotifier } from './fake-dirty-notifier';
import { TabViewport, type TabViewportDeps } from './tab-viewport.svelte';

function makeViewport(overrides: Partial<Omit<TabViewportDeps, 'notifier'>> = {}) {
	const notifier = createFakeDirtyNotifier();
	const tabViewport = new TabViewport({
		initial: viewportOps.forCanvas(16, 16),
		initialViewportSize: { width: 512, height: 512 },
		getCanvasDimensions: () => ({ width: 16, height: 16 }),
		getReferenceFootprint: () => null,
		viewportOps,
		notifier,
		documentId: 'doc-1',
		...overrides
	});
	return { tabViewport, notifier };
}

describe('TabViewport', () => {
	describe('apply', () => {
		it('writes the supplied viewport and emits markDirty', () => {
			const { tabViewport, notifier } = makeViewport();

			const next = { ...tabViewport.viewport, zoom: 2.0 };
			tabViewport.apply(next);

			expect(tabViewport.viewport.zoom).toBe(2.0);
			expect(notifier.dirtyCalls).toEqual(['doc-1']);
		});
	});

	describe('zoomIn / zoomOut', () => {
		it('zoomIn steps to nextZoomLevel and re-centers pan on viewportSize', () => {
			const initial = viewportOps.forCanvas(16, 16);
			const { tabViewport, notifier } = makeViewport({ initial });

			tabViewport.zoomIn();

			const expectedZoom = viewportOps.nextZoomLevel(initial.zoom);
			// zoom centers on the viewport, then the result is clamped to the
			// Navigation Bounds (canvas-only here, no footprint).
			const expected = viewportOps.clampPanToDocumentBounds(
				viewportOps.zoomAtPoint(initial, 256, 256, expectedZoom),
				0,
				0,
				16,
				16,
				512,
				512
			);
			expect(tabViewport.viewport.zoom).toBe(expectedZoom);
			expect(tabViewport.viewport.panX).toBe(expected.panX);
			expect(tabViewport.viewport.panY).toBe(expected.panY);
			expect(notifier.dirtyCalls).toEqual(['doc-1']);
		});

		it('zoomOut steps to prevZoomLevel and re-centers pan on viewportSize', () => {
			const initial = { ...viewportOps.forCanvas(16, 16), zoom: 4.0 };
			const { tabViewport, notifier } = makeViewport({ initial });

			tabViewport.zoomOut();

			const expectedZoom = viewportOps.prevZoomLevel(initial.zoom);
			const expected = viewportOps.clampPanToDocumentBounds(
				viewportOps.zoomAtPoint(initial, 256, 256, expectedZoom),
				0,
				0,
				16,
				16,
				512,
				512
			);
			expect(tabViewport.viewport.zoom).toBe(expectedZoom);
			expect(tabViewport.viewport.panX).toBe(expected.panX);
			expect(tabViewport.viewport.panY).toBe(expected.panY);
			expect(notifier.dirtyCalls).toEqual(['doc-1']);
		});
	});

	describe('zoomReset', () => {
		it('returns zoom to 1.0 and re-centers pan on viewportSize', () => {
			const initial = { ...viewportOps.forCanvas(16, 16), zoom: 4.0 };
			const { tabViewport, notifier } = makeViewport({ initial });

			tabViewport.zoomReset();

			const expected = viewportOps.clampPanToDocumentBounds(
				viewportOps.zoomAtPoint(initial, 256, 256, 1.0),
				0,
				0,
				16,
				16,
				512,
				512
			);
			expect(tabViewport.viewport.zoom).toBe(1.0);
			expect(tabViewport.viewport.panX).toBe(expected.panX);
			expect(tabViewport.viewport.panY).toBe(expected.panY);
			expect(notifier.dirtyCalls).toEqual(['doc-1']);
		});
	});

	describe('zoomFit', () => {
		it('respects maxZoom against current canvas dimensions', () => {
			const { tabViewport, notifier } = makeViewport({
				initial: viewportOps.forCanvas(8, 8),
				initialViewportSize: { width: 800, height: 600 },
				getCanvasDimensions: () => ({ width: 8, height: 8 })
			});

			tabViewport.zoomFit(2.0);

			expect(tabViewport.viewport.zoom).toBeLessThanOrEqual(2.0);
			expect(notifier.dirtyCalls).toEqual(['doc-1']);
		});
	});

	describe('toggleGrid', () => {
		it('flips showGrid and emits markDirty', () => {
			const { tabViewport, notifier } = makeViewport();
			const startedShowing = tabViewport.viewport.showGrid;

			tabViewport.toggleGrid();
			expect(tabViewport.viewport.showGrid).toBe(!startedShowing);

			tabViewport.toggleGrid();
			expect(tabViewport.viewport.showGrid).toBe(startedShowing);

			expect(notifier.dirtyCalls).toEqual(['doc-1', 'doc-1']);
		});
	});

	describe('toggleOnionSkin', () => {
		it('flips showOnionSkin and emits markDirty', () => {
			const { tabViewport, notifier } = makeViewport();
			const startedShowing = tabViewport.viewport.showOnionSkin;

			tabViewport.toggleOnionSkin();
			expect(tabViewport.viewport.showOnionSkin).toBe(!startedShowing);

			tabViewport.toggleOnionSkin();
			expect(tabViewport.viewport.showOnionSkin).toBe(startedShowing);

			expect(notifier.dirtyCalls).toEqual(['doc-1', 'doc-1']);
		});
	});

	describe('setViewportSize', () => {
		it('updates viewportSize without marking dirty when the reclamp leaves pan unchanged', () => {
			const { tabViewport, notifier } = makeViewport();

			tabViewport.setViewportSize({ width: 800, height: 600 });

			expect(tabViewport.viewportSize).toEqual({ width: 800, height: 600 });
			expect(notifier.dirtyCalls).toEqual([]);
		});

		it('marks dirty when the new viewport size relocates the adopted pan', () => {
			// A restored snapshot can carry an out-of-bounds pan; construction
			// adopts it as-is and it self-corrects on the first size measurement.
			const initial = { ...viewportOps.forCanvas(16, 16), panX: 5000, panY: 5000 };
			const { tabViewport, notifier } = makeViewport({ initial });
			expect(tabViewport.viewport.panX).toBe(5000);

			tabViewport.setViewportSize({ width: 512, height: 512 });

			const expected = viewportOps.clampPanToDocumentBounds(initial, 0, 0, 16, 16, 512, 512);
			expect(tabViewport.viewport.panX).toBe(expected.panX);
			expect(tabViewport.viewport.panY).toBe(expected.panY);
			expect(notifier.dirtyCalls).toEqual(['doc-1']);
		});
	});

	describe('reclamp', () => {
		it('re-clamps the current pan against the canvas when there is no footprint', () => {
			const initial = { ...viewportOps.forCanvas(16, 16), panX: 5000, panY: 5000 };
			const { tabViewport } = makeViewport({ initial });
			// construction adopts the snapshot as-is
			expect(tabViewport.viewport.panX).toBe(5000);

			tabViewport.reclamp();

			const expected = viewportOps.clampPanToDocumentBounds(initial, 0, 0, 16, 16, 512, 512);
			expect(tabViewport.viewport.panX).toBe(expected.panX);
			expect(tabViewport.viewport.panY).toBe(expected.panY);
		});

		it('does not mark dirty when pan is already within bounds', () => {
			const { tabViewport, notifier } = makeViewport();

			tabViewport.reclamp();

			expect(notifier.dirtyCalls).toEqual([]);
		});
	});

	describe('navigation-bounds clamping', () => {
		it('apply clamps pan to the injected Reference footprint', () => {
			const footprint = { minX: 0, minY: 0, maxX: 200, maxY: 200 };
			const { tabViewport } = makeViewport({ getReferenceFootprint: () => footprint });

			const requested = { ...tabViewport.viewport, panX: -9999, panY: -9999 };
			tabViewport.apply(requested);

			const expected = viewportOps.clampPanToDocumentBounds(
				requested,
				footprint.minX,
				footprint.minY,
				footprint.maxX,
				footprint.maxY,
				512,
				512
			);
			expect(tabViewport.viewport.panX).toBe(expected.panX);
			expect(tabViewport.viewport.panY).toBe(expected.panY);
		});

		it('reclamp expands pan reach to the Reference footprint beyond the canvas', () => {
			const footprint = { minX: 0, minY: 0, maxX: 200, maxY: 200 };
			const initial = { ...viewportOps.forCanvas(16, 16), panX: -5000, panY: -5000 };
			const { tabViewport } = makeViewport({ initial, getReferenceFootprint: () => footprint });

			tabViewport.reclamp();

			const expanded = viewportOps.clampPanToDocumentBounds(initial, 0, 0, 200, 200, 512, 512);
			const canvasOnly = viewportOps.clampPanToDocumentBounds(initial, 0, 0, 16, 16, 512, 512);
			expect(tabViewport.viewport.panX).toBe(expanded.panX);
			expect(tabViewport.viewport.panX).toBeLessThan(canvasOnly.panX);
		});

		it('a zoom gesture clamps the post-zoom pan against the footprint, not the canvas', () => {
			const footprint = { minX: 0, minY: 0, maxX: 200, maxY: 200 };
			// An off-center pan is adopted as-is at construction so the post-zoom
			// pan lands outside the canvas region but within the larger footprint.
			const initial = { ...viewportOps.forCanvas(16, 16), panX: -5000, panY: -5000, zoom: 4.0 };
			const { tabViewport } = makeViewport({ initial, getReferenceFootprint: () => footprint });

			tabViewport.zoomReset();

			const zoomed = viewportOps.zoomAtPoint(initial, 256, 256, 1.0);
			const expected = viewportOps.clampPanToDocumentBounds(zoomed, 0, 0, 200, 200, 512, 512);
			const canvasOnly = viewportOps.clampPanToDocumentBounds(zoomed, 0, 0, 16, 16, 512, 512);
			expect(tabViewport.viewport.panX).toBe(expected.panX);
			expect(tabViewport.viewport.panY).toBe(expected.panY);
			expect(tabViewport.viewport.panX).toBeLessThan(canvasOnly.panX);
		});
	});

	describe('markDirty fan-out', () => {
		it('every viewport-value mutation emits exactly one markDirty per call', () => {
			const { tabViewport, notifier } = makeViewport();

			tabViewport.apply({ ...tabViewport.viewport, zoom: 2.0 });
			tabViewport.zoomIn();
			tabViewport.zoomOut();
			tabViewport.zoomReset();
			tabViewport.zoomFit();
			tabViewport.toggleGrid();

			expect(notifier.dirtyCalls.length).toBe(6);
			expect(notifier.dirtyCalls.every((id) => id === 'doc-1')).toBe(true);
		});
	});
});
