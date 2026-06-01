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

	it('renders the DefineMarquee dimension tooltip above the live pointer', () => {
		render(SelectionOverlay, {
			marquee: region(),
			canvasWidth: 8,
			canvasHeight: 8,
			viewport,
			viewportSize: { width: 240, height: 180 },
			dragAid: {
				phase: 'defineMarquee',
				pointer: { x: 120, y: 80 }
			}
		});

		const tooltip = screen.getByTestId('selection-drag-tooltip');

		expect(tooltip.textContent).toBe('3×4');
		expect(tooltip.style.left).toBe('88px');
		expect(tooltip.style.top).toBe('36px');
	});

	it('formats DefineMarquee dimensions as integer pixel counts', () => {
		render(SelectionOverlay, {
			marquee: region({ width: 150.30000000000001, height: 75.5 }),
			canvasWidth: 512,
			canvasHeight: 512,
			viewport,
			viewportSize: { width: 240, height: 180 },
			dragAid: {
				phase: 'defineMarquee',
				pointer: { x: 120, y: 80 }
			}
		});

		expect(screen.getByTestId('selection-drag-tooltip').textContent).toBe('150×76');
	});

	it('renders DefineMarquee crosshair guides from the live pointer to the viewport edges', () => {
		render(SelectionOverlay, {
			marquee: region(),
			canvasWidth: 8,
			canvasHeight: 8,
			viewport,
			viewportSize: { width: 240, height: 180 },
			dragAid: {
				phase: 'defineMarquee',
				pointer: { x: 120, y: 80 }
			}
		});

		const guides = screen.getByTestId('selection-drag-guides');
		const lines = guides.querySelectorAll('line');

		expect(guides.getAttribute('viewBox')).toBe('0 0 240 180');
		expect(lines).toHaveLength(4);
		expect(lines[0].getAttribute('x1')).toBe('0');
		expect(lines[0].getAttribute('x2')).toBe('120');
		expect(lines[0].getAttribute('y1')).toBe('80');
		expect(lines[0].getAttribute('y2')).toBe('80');
		expect(lines[1].getAttribute('x1')).toBe('120');
		expect(lines[1].getAttribute('x2')).toBe('240');
		expect(lines[1].getAttribute('y1')).toBe('80');
		expect(lines[1].getAttribute('y2')).toBe('80');
		expect(lines[2].getAttribute('x1')).toBe('120');
		expect(lines[2].getAttribute('x2')).toBe('120');
		expect(lines[2].getAttribute('y1')).toBe('0');
		expect(lines[2].getAttribute('y2')).toBe('80');
		expect(lines[3].getAttribute('x1')).toBe('120');
		expect(lines[3].getAttribute('x2')).toBe('120');
		expect(lines[3].getAttribute('y1')).toBe('80');
		expect(lines[3].getAttribute('y2')).toBe('180');
	});

	it('clamps DefineMarquee crosshair guides to the viewport bounds', () => {
		render(SelectionOverlay, {
			marquee: region(),
			canvasWidth: 8,
			canvasHeight: 8,
			viewport,
			viewportSize: { width: 240, height: 180 },
			dragAid: {
				phase: 'defineMarquee',
				pointer: { x: -20, y: 220 }
			}
		});

		const guides = screen.getByTestId('selection-drag-guides');
		const lines = guides.querySelectorAll('line');

		expect(lines[0].getAttribute('x2')).toBe('0');
		expect(lines[0].getAttribute('y1')).toBe('180');
		expect(lines[1].getAttribute('x1')).toBe('0');
		expect(lines[1].getAttribute('y2')).toBe('180');
		expect(lines[2].getAttribute('x1')).toBe('0');
		expect(lines[2].getAttribute('y2')).toBe('180');
		expect(lines[3].getAttribute('x1')).toBe('0');
		expect(lines[3].getAttribute('y1')).toBe('180');
	});

	it('does not render drag aids during LiftAndDrag', () => {
		render(SelectionOverlay, {
			marquee: region(),
			canvasWidth: 8,
			canvasHeight: 8,
			viewport,
			viewportSize: { width: 240, height: 180 },
			dragAid: {
				phase: 'liftAndDrag',
				pointer: { x: 120, y: 80 }
			}
		});

		expect(screen.queryByTestId('selection-drag-tooltip')).toBeNull();
		expect(screen.queryByTestId('selection-drag-guides')).toBeNull();
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

	it('lets the drag tooltip grow beyond its minimum width', () => {
		expect(selectionOverlaySource).toContain('min-width: 64px;');
		expect(selectionOverlaySource).toContain('width: max-content;');
		expect(selectionOverlaySource).not.toContain('\t\twidth: 64px;');
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
