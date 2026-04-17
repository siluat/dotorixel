// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import Loupe from './Loupe.svelte';
import type { Color } from '$lib/canvas/color';

const OPAQUE_BLUE: Color = { r: 0, g: 0, b: 255, a: 255 };
const TRANSPARENT: Color = { r: 0, g: 0, b: 0, a: 0 };

function makeGrid(fill: Color): Color[] {
	return Array.from({ length: 81 }, () => fill);
}

afterEach(() => {
	cleanup();
});

describe('Loupe', () => {
	it('renders nothing when screenPointer is null', () => {
		const { container } = render(Loupe, {
			props: {
				grid: makeGrid(OPAQUE_BLUE),
				centerColor: OPAQUE_BLUE,
				screenPointer: null
			}
		});

		expect(container.querySelector('[data-testid="loupe-root"]')).toBeNull();
	});

	it('renders an 81-cell grid when screenPointer is provided', () => {
		const { container } = render(Loupe, {
			props: {
				grid: makeGrid(OPAQUE_BLUE),
				centerColor: OPAQUE_BLUE,
				screenPointer: { x: 100, y: 200 }
			}
		});

		const cells = container.querySelectorAll('.cell');
		expect(cells.length).toBe(81);
	});

	it('displays the center color hex in uppercase', () => {
		const { getByTestId } = render(Loupe, {
			props: {
				grid: makeGrid(OPAQUE_BLUE),
				centerColor: { r: 0x4b, g: 0x2a, b: 0x1a, a: 255 },
				screenPointer: { x: 0, y: 0 }
			}
		});

		expect(getByTestId('loupe-hex-text').textContent?.trim()).toBe('#4B2A1A');
	});

	it('displays an em-dash when centerColor is null (out of canvas)', () => {
		const { getByTestId } = render(Loupe, {
			props: {
				grid: makeGrid(TRANSPARENT),
				centerColor: null,
				screenPointer: { x: 0, y: 0 }
			}
		});

		expect(getByTestId('loupe-hex-text').textContent?.trim()).toBe('—');
	});

	it('displays an em-dash when the center pixel is transparent', () => {
		const { getByTestId } = render(Loupe, {
			props: {
				grid: makeGrid(TRANSPARENT),
				centerColor: TRANSPARENT,
				screenPointer: { x: 0, y: 0 }
			}
		});

		expect(getByTestId('loupe-hex-text').textContent?.trim()).toBe('—');
	});

	it('exposes the pointer coordinates as CSS variables on the root', () => {
		const { getByTestId } = render(Loupe, {
			props: {
				grid: makeGrid(OPAQUE_BLUE),
				centerColor: OPAQUE_BLUE,
				screenPointer: { x: 150, y: 250 }
			}
		});

		const root = getByTestId('loupe-root') as HTMLElement;
		expect(root.style.getPropertyValue('--pointer-x')).toBe('150px');
		expect(root.style.getPropertyValue('--pointer-y')).toBe('250px');
	});

	it('marks exactly one cell (index 40) as the center cell', () => {
		const { container } = render(Loupe, {
			props: {
				grid: makeGrid(OPAQUE_BLUE),
				centerColor: OPAQUE_BLUE,
				screenPointer: { x: 0, y: 0 }
			}
		});

		const centers = container.querySelectorAll('.cell--center');
		expect(centers.length).toBe(1);
	});

	it('fills each opaque grid cell with its sampled rgb color', () => {
		const red: Color = { r: 255, g: 0, b: 0, a: 255 };
		const { container } = render(Loupe, {
			props: {
				grid: makeGrid(red),
				centerColor: red,
				screenPointer: { x: 0, y: 0 }
			}
		});

		const firstCell = container.querySelector('.cell') as HTMLElement;
		// happy-dom normalizes inline color to rgb(...) form.
		expect(firstCell.style.backgroundColor).toBe('rgb(255, 0, 0)');
	});
});
