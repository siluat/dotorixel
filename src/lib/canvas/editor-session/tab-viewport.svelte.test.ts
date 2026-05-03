// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { viewportOps } from '../wasm-backend';
import { createFakeDirtyNotifier } from './fake-dirty-notifier';
import { TabViewport } from './tab-viewport.svelte';

describe('TabViewport', () => {
	describe('apply', () => {
		it('writes the supplied viewport and emits markDirty', () => {
			const notifier = createFakeDirtyNotifier();
			const initial = viewportOps.forCanvas(16, 16);
			const tabViewport = new TabViewport({
				initial,
				initialViewportSize: { width: 512, height: 512 },
				getCanvasDimensions: () => ({ width: 16, height: 16 }),
				viewportOps,
				notifier,
				documentId: 'doc-1'
			});

			const next = { ...initial, zoom: 2.0 };
			tabViewport.apply(next);

			expect(tabViewport.viewport.zoom).toBe(2.0);
			expect(notifier.dirtyCalls).toEqual(['doc-1']);
		});
	});

	describe('zoomIn / zoomOut', () => {
		it('zoomIn steps to nextZoomLevel centered on viewportSize', () => {
			const notifier = createFakeDirtyNotifier();
			const initial = viewportOps.forCanvas(16, 16);
			const viewportSize = { width: 512, height: 512 };
			const tabViewport = new TabViewport({
				initial,
				initialViewportSize: viewportSize,
				getCanvasDimensions: () => ({ width: 16, height: 16 }),
				viewportOps,
				notifier,
				documentId: 'doc-1'
			});

			tabViewport.zoomIn();

			const expectedZoom = viewportOps.nextZoomLevel(initial.zoom);
			const expected = viewportOps.zoomAtPoint(
				initial,
				viewportSize.width / 2,
				viewportSize.height / 2,
				expectedZoom
			);
			expect(tabViewport.viewport.zoom).toBe(expectedZoom);
			expect(tabViewport.viewport.panX).toBe(expected.panX);
			expect(tabViewport.viewport.panY).toBe(expected.panY);
			expect(notifier.dirtyCalls).toEqual(['doc-1']);
		});

		it('zoomOut steps to prevZoomLevel centered on viewportSize', () => {
			const notifier = createFakeDirtyNotifier();
			const initial = { ...viewportOps.forCanvas(16, 16), zoom: 4.0 };
			const viewportSize = { width: 512, height: 512 };
			const tabViewport = new TabViewport({
				initial,
				initialViewportSize: viewportSize,
				getCanvasDimensions: () => ({ width: 16, height: 16 }),
				viewportOps,
				notifier,
				documentId: 'doc-1'
			});

			tabViewport.zoomOut();

			const expectedZoom = viewportOps.prevZoomLevel(initial.zoom);
			const expected = viewportOps.zoomAtPoint(
				initial,
				viewportSize.width / 2,
				viewportSize.height / 2,
				expectedZoom
			);
			expect(tabViewport.viewport.zoom).toBe(expectedZoom);
			expect(tabViewport.viewport.panX).toBe(expected.panX);
			expect(tabViewport.viewport.panY).toBe(expected.panY);
			expect(notifier.dirtyCalls).toEqual(['doc-1']);
		});
	});

	describe('zoomReset', () => {
		it('returns zoom to 1.0 centered on viewportSize', () => {
			const notifier = createFakeDirtyNotifier();
			const initial = { ...viewportOps.forCanvas(16, 16), zoom: 4.0 };
			const viewportSize = { width: 512, height: 512 };
			const tabViewport = new TabViewport({
				initial,
				initialViewportSize: viewportSize,
				getCanvasDimensions: () => ({ width: 16, height: 16 }),
				viewportOps,
				notifier,
				documentId: 'doc-1'
			});

			tabViewport.zoomReset();

			const expected = viewportOps.zoomAtPoint(
				initial,
				viewportSize.width / 2,
				viewportSize.height / 2,
				1.0
			);
			expect(tabViewport.viewport.zoom).toBe(1.0);
			expect(tabViewport.viewport.panX).toBe(expected.panX);
			expect(tabViewport.viewport.panY).toBe(expected.panY);
			expect(notifier.dirtyCalls).toEqual(['doc-1']);
		});
	});

	describe('zoomFit', () => {
		it('respects maxZoom against current canvas dimensions', () => {
			const notifier = createFakeDirtyNotifier();
			const initial = viewportOps.forCanvas(8, 8);
			const tabViewport = new TabViewport({
				initial,
				initialViewportSize: { width: 800, height: 600 },
				getCanvasDimensions: () => ({ width: 8, height: 8 }),
				viewportOps,
				notifier,
				documentId: 'doc-1'
			});

			tabViewport.zoomFit(2.0);

			expect(tabViewport.viewport.zoom).toBeLessThanOrEqual(2.0);
			expect(notifier.dirtyCalls).toEqual(['doc-1']);
		});
	});

	describe('toggleGrid', () => {
		it('flips showGrid and emits markDirty', () => {
			const notifier = createFakeDirtyNotifier();
			const initial = viewportOps.forCanvas(16, 16);
			const tabViewport = new TabViewport({
				initial,
				initialViewportSize: { width: 512, height: 512 },
				getCanvasDimensions: () => ({ width: 16, height: 16 }),
				viewportOps,
				notifier,
				documentId: 'doc-1'
			});
			const startedShowing = initial.showGrid;

			tabViewport.toggleGrid();
			expect(tabViewport.viewport.showGrid).toBe(!startedShowing);

			tabViewport.toggleGrid();
			expect(tabViewport.viewport.showGrid).toBe(startedShowing);

			expect(notifier.dirtyCalls).toEqual(['doc-1', 'doc-1']);
		});
	});

	describe('reclamp', () => {
		it('re-applies clampPan against the current canvas dimensions read through the getter', () => {
			const notifier = createFakeDirtyNotifier();
			const initial = viewportOps.forCanvas(16, 16);
			const dimensions = { width: 16, height: 16 };
			const tabViewport = new TabViewport({
				initial,
				initialViewportSize: { width: 512, height: 512 },
				getCanvasDimensions: () => dimensions,
				viewportOps,
				notifier,
				documentId: 'doc-1'
			});

			const panned = { ...initial, panX: 5000, panY: 5000 };
			tabViewport.apply(panned);

			dimensions.width = 8;
			dimensions.height = 8;

			tabViewport.reclamp();

			const expected = viewportOps.clampPan(panned, 8, 8, 512, 512);
			expect(tabViewport.viewport.panX).toBe(expected.panX);
			expect(tabViewport.viewport.panY).toBe(expected.panY);
		});
	});

	describe('setViewportSize', () => {
		it('updates viewportSize without emitting markDirty (DOM-measurement layout state, not persisted)', () => {
			const notifier = createFakeDirtyNotifier();
			const initial = viewportOps.forCanvas(16, 16);
			const tabViewport = new TabViewport({
				initial,
				initialViewportSize: { width: 512, height: 512 },
				getCanvasDimensions: () => ({ width: 16, height: 16 }),
				viewportOps,
				notifier,
				documentId: 'doc-1'
			});

			tabViewport.setViewportSize({ width: 800, height: 600 });

			expect(tabViewport.viewportSize).toEqual({ width: 800, height: 600 });
			expect(notifier.dirtyCalls).toEqual([]);
		});
	});

	describe('markDirty fan-out', () => {
		it('every persistable mutating method emits exactly one markDirty per call (setViewportSize excluded — layout-only)', () => {
			const notifier = createFakeDirtyNotifier();
			const initial = viewportOps.forCanvas(16, 16);
			const tabViewport = new TabViewport({
				initial,
				initialViewportSize: { width: 512, height: 512 },
				getCanvasDimensions: () => ({ width: 16, height: 16 }),
				viewportOps,
				notifier,
				documentId: 'doc-1'
			});

			tabViewport.apply({ ...initial, zoom: 2.0 });
			tabViewport.setViewportSize({ width: 800, height: 600 });
			tabViewport.zoomIn();
			tabViewport.zoomOut();
			tabViewport.zoomReset();
			tabViewport.zoomFit();
			tabViewport.toggleGrid();
			tabViewport.reclamp();

			expect(notifier.dirtyCalls.length).toBe(7);
			expect(notifier.dirtyCalls.every((id) => id === 'doc-1')).toBe(true);
		});
	});
});
