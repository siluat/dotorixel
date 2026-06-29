// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import ReferenceLayerPlacementOverlay from './ReferenceLayerPlacementOverlay.svelte';
import type { ReferenceLayerUnderlay } from './reference-layer-underlay';
import type { ViewportData } from './viewport';

afterEach(() => cleanup());

const viewport: ViewportData = {
	pixelSize: 10,
	zoom: 1,
	panX: 3.2,
	panY: 4.6,
	showGrid: false,
	gridColor: '#000000'
};

const referenceLayerUnderlay: ReferenceLayerUnderlay = {
	sourceKey: 'reference-overlay',
	sourceRgba: new Uint8Array(2 * 1 * 4),
	naturalWidth: 2,
	naturalHeight: 1,
	placement: { x: 0.5, y: 1, scale: 2 },
	projectedBounds: { minX: 0.5, minY: 1, maxX: 4.5, maxY: 3 },
	opacity: 1
};

describe('ReferenceLayerPlacementOverlay', () => {
	it('projects the active Reference Layer footprint with the same viewport transform as the underlay', () => {
		render(ReferenceLayerPlacementOverlay, {
			referenceLayerUnderlay,
			viewport,
			isReferenceLayerActive: true
		});

		const overlay = screen.getByTestId('reference-placement-overlay');

		expect(overlay.style.left).toBe('8px');
		expect(overlay.style.top).toBe('15px');
		expect(overlay.style.width).toBe('40px');
		expect(overlay.style.height).toBe('20px');
	});

	it('renders nothing when the Reference Layer is not active', () => {
		render(ReferenceLayerPlacementOverlay, {
			referenceLayerUnderlay,
			viewport,
			isReferenceLayerActive: false
		});

		expect(screen.queryByTestId('reference-placement-overlay')).toBeNull();
	});

	it('renders exactly four constant-size corner handles for desktop input', () => {
		render(ReferenceLayerPlacementOverlay, {
			referenceLayerUnderlay,
			viewport: { ...viewport, zoom: 4 },
			isReferenceLayerActive: true,
			pointerType: 'mouse'
		});

		const overlay = screen.getByTestId('reference-placement-overlay');
		const handles = screen.getAllByTestId('reference-placement-handle');

		expect(handles).toHaveLength(4);
		expect(overlay.style.getPropertyValue('--handle-size')).toBe('12px');
	});

	it('uses the larger constant handle size for touch input', () => {
		render(ReferenceLayerPlacementOverlay, {
			referenceLayerUnderlay,
			viewport,
			isReferenceLayerActive: true,
			pointerType: 'touch'
		});

		expect(screen.getByTestId('reference-placement-overlay').style.getPropertyValue('--handle-size')).toBe(
			'16px'
		);
	});

	it('marks corner resize zones and exposes an invisible 44px handle hit area', () => {
		render(ReferenceLayerPlacementOverlay, {
			referenceLayerUnderlay,
			viewport,
			isReferenceLayerActive: true,
			pointerType: 'touch'
		});

		const overlay = screen.getByTestId('reference-placement-overlay');
		const handles = screen.getAllByTestId('reference-placement-handle');

		expect(overlay.style.getPropertyValue('--handle-hit-size')).toBe('44px');
		expect(handles.map((handle) => handle.getAttribute('data-reference-placement-handle'))).toEqual([
			'nw',
			'ne',
			'se',
			'sw'
		]);
	});

	it('receives read-only pointer starts instead of letting hit-testing fall through', () => {
		render(ReferenceLayerPlacementOverlay, {
			referenceLayerUnderlay,
			viewport,
			isReferenceLayerActive: true
		});

		const event = new Event('pointerdown', { bubbles: true, cancelable: true });
		const overlay = screen.getByTestId('reference-placement-overlay');
		overlay.dispatchEvent(event);

		expect(overlay.style.pointerEvents).toBe('auto');
		expect(event.defaultPrevented).toBe(true);
	});

	it('uses auto as the default body cursor', () => {
		render(ReferenceLayerPlacementOverlay, {
			referenceLayerUnderlay,
			viewport,
			isReferenceLayerActive: true
		});

		const overlay = screen.getByTestId('reference-placement-overlay');
		expect(overlay.style.cursor).toBe('auto');
	});

	it('uses the provided body cursor', () => {
		render(ReferenceLayerPlacementOverlay, {
			referenceLayerUnderlay,
			viewport,
			isReferenceLayerActive: true,
			bodyCursor: 'not-allowed'
		});

		expect(screen.getByTestId('reference-placement-overlay').style.cursor).toBe('not-allowed');
	});
});
