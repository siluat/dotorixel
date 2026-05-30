// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import SelectionOverlay from './SelectionOverlay.svelte';
import selectionOverlaySource from './SelectionOverlay.svelte?raw';
import type { MarqueeRegion } from './canvas-model';
import type { ViewportData } from './viewport';

afterEach(() => cleanup());

const viewport: ViewportData = {
	pixelSize: 10,
	zoom: 2,
	panX: 3.2,
	panY: 4.6,
	showGrid: false,
	gridColor: '#000000'
};

function region(overrides: Partial<MarqueeRegion> = {}): MarqueeRegion {
	return {
		x: 1,
		y: 2,
		width: 3,
		height: 4,
		contains: () => false,
		translate: () => region(),
		clip_to: () => undefined,
		...overrides
	};
}

describe('SelectionOverlay', () => {
	it('projects a Marquee into viewport pixel coordinates', () => {
		render(SelectionOverlay, {
			marquee: region(),
			canvasWidth: 8,
			canvasHeight: 8,
			viewport
		});

		const overlay = screen.getByTestId('selection-overlay');

		expect(overlay.style.left).toBe('23px');
		expect(overlay.style.top).toBe('45px');
		expect(overlay.style.width).toBe('60px');
		expect(overlay.style.height).toBe('80px');
	});

	it('clips partially off-canvas Marquees to the visible document bounds', () => {
		render(SelectionOverlay, {
			marquee: region({ x: -2, y: 1, width: 5, height: 5 }),
			canvasWidth: 8,
			canvasHeight: 4,
			viewport
		});

		const overlay = screen.getByTestId('selection-overlay');

		expect(overlay.style.left).toBe('3px');
		expect(overlay.style.top).toBe('25px');
		expect(overlay.style.width).toBe('60px');
		expect(overlay.style.height).toBe('60px');
	});

	it('uses rounded effective pixel size to match canvas rendering', () => {
		render(SelectionOverlay, {
			marquee: region(),
			canvasWidth: 8,
			canvasHeight: 8,
			viewport: { ...viewport, zoom: 1.26 }
		});

		const overlay = screen.getByTestId('selection-overlay');

		expect(overlay.style.left).toBe('16px');
		expect(overlay.style.top).toBe('31px');
		expect(overlay.style.width).toBe('39px');
		expect(overlay.style.height).toBe('52px');
	});

	it('renders nothing when the Marquee is outside the canvas', () => {
		render(SelectionOverlay, {
			marquee: region({ x: -4, y: 1, width: 2, height: 2 }),
			canvasWidth: 8,
			canvasHeight: 8,
			viewport
		});

		expect(screen.queryByTestId('selection-overlay')).toBeNull();
	});

	it('documents the marching-ants cadence and reduced-motion fallback in CSS', () => {
		render(SelectionOverlay, {
			marquee: region(),
			canvasWidth: 8,
			canvasHeight: 8,
			viewport
		});

		expect(selectionOverlaySource).toContain('600ms linear infinite');
		expect(selectionOverlaySource).toContain('stroke-dashoffset: 8');
		expect(selectionOverlaySource).toContain('prefers-reduced-motion: reduce');
		expect(selectionOverlaySource).toContain('stroke-dashoffset: 0');
	});
});
