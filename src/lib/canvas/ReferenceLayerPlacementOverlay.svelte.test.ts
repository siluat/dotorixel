// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import ReferenceLayerPlacementOverlay from './ReferenceLayerPlacementOverlay.svelte';
import type { ReferenceUnderlay } from './renderer';
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

const referenceUnderlay: ReferenceUnderlay = {
	sourceKey: 'reference-overlay',
	sourceRgba: new Uint8Array(2 * 1 * 4),
	naturalWidth: 2,
	naturalHeight: 1,
	placement: { x: 0.5, y: 1, scale: 2 },
	opacity: 1
};

describe('ReferenceLayerPlacementOverlay', () => {
	it('projects the active Reference Layer footprint with the same viewport transform as the underlay', () => {
		render(ReferenceLayerPlacementOverlay, {
			referenceUnderlay,
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
			referenceUnderlay,
			viewport,
			isReferenceLayerActive: false
		});

		expect(screen.queryByTestId('reference-placement-overlay')).toBeNull();
	});

	it('renders exactly four constant-size corner handles for desktop input', () => {
		render(ReferenceLayerPlacementOverlay, {
			referenceUnderlay,
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
			referenceUnderlay,
			viewport,
			isReferenceLayerActive: true,
			pointerType: 'touch'
		});

		expect(screen.getByTestId('reference-placement-overlay').style.getPropertyValue('--handle-size')).toBe(
			'16px'
		);
	});

	it('receives read-only pointer starts instead of letting hit-testing fall through', () => {
		render(ReferenceLayerPlacementOverlay, {
			referenceUnderlay,
			viewport,
			isReferenceLayerActive: true
		});

		const event = new Event('pointerdown', { bubbles: true, cancelable: true });
		const overlay = screen.getByTestId('reference-placement-overlay');
		overlay.dispatchEvent(event);

		expect(overlay.style.pointerEvents).toBe('auto');
		expect(event.defaultPrevented).toBe(true);
	});
});
