// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import Loupe from './Loupe.svelte';
import type { Color } from '$lib/canvas/color';

const OPAQUE_BLUE: Color = { r: 0, g: 0, b: 255, a: 255 };
const TRANSPARENT: Color = { r: 0, g: 0, b: 0, a: 0 };

// Roomy viewport so existing rendering tests never trigger quadrant flips
// or clamping. Positioning behavior gets its own dedicated describe below.
const TEST_VIEWPORT = { width: 1200, height: 800 } as const;

function makeGrid(fill: Color): Color[] {
	return Array.from({ length: 81 }, () => fill);
}

function makeGridWithNullAt(fill: Color, nullIndices: number[]): (Color | null)[] {
	const grid: (Color | null)[] = Array.from({ length: 81 }, () => fill);
	for (const i of nullIndices) grid[i] = null;
	return grid;
}

function makeGridWithTransparentAt(fill: Color, transparentIndices: number[]): (Color | null)[] {
	const grid: (Color | null)[] = Array.from({ length: 81 }, () => fill);
	for (const i of transparentIndices) grid[i] = TRANSPARENT;
	return grid;
}

function makeGridWithCenter(fill: Color, center: Color | null): (Color | null)[] {
	const grid: (Color | null)[] = Array.from({ length: 81 }, () => fill);
	grid[40] = center;
	return grid;
}

afterEach(() => {
	cleanup();
});

describe('Loupe', () => {
	it('renders nothing when screenPointer is null', () => {
		const { container } = render(Loupe, {
			props: { grid: makeGrid(OPAQUE_BLUE), screenPointer: null, viewport: TEST_VIEWPORT, inputSource: 'mouse' }
		});

		expect(container.querySelector('[data-testid="loupe-root"]')).toBeNull();
	});

	it('renders an 81-cell grid when screenPointer is provided', () => {
		const { container } = render(Loupe, {
			props: { grid: makeGrid(OPAQUE_BLUE), screenPointer: { x: 100, y: 200 }, viewport: TEST_VIEWPORT, inputSource: 'mouse' }
		});

		const cells = container.querySelectorAll('.cell');
		expect(cells.length).toBe(81);
	});

	it('displays the center color hex in uppercase', () => {
		const { getByTestId } = render(Loupe, {
			props: {
				grid: makeGridWithCenter(OPAQUE_BLUE, { r: 0x4b, g: 0x2a, b: 0x1a, a: 255 }),
				screenPointer: { x: 0, y: 0 },
				viewport: TEST_VIEWPORT,
				inputSource: 'mouse'
			}
		});

		expect(getByTestId('loupe-hex-text').textContent?.trim()).toBe('#4B2A1A');
	});

	it('displays an em-dash when the center cell is null (out of canvas)', () => {
		const { getByTestId } = render(Loupe, {
			props: {
				grid: makeGridWithCenter(OPAQUE_BLUE, null),
				screenPointer: { x: 0, y: 0 },
				viewport: TEST_VIEWPORT,
				inputSource: 'mouse'
			}
		});

		expect(getByTestId('loupe-hex-text').textContent?.trim()).toBe('—');
	});

	it('displays an em-dash when the center cell is transparent', () => {
		const { getByTestId } = render(Loupe, {
			props: {
				grid: makeGridWithCenter(OPAQUE_BLUE, TRANSPARENT),
				screenPointer: { x: 0, y: 0 },
				viewport: TEST_VIEWPORT,
				inputSource: 'mouse'
			}
		});

		expect(getByTestId('loupe-hex-text').textContent?.trim()).toBe('—');
	});

	it('marks the swatch with the swatch--out-of-canvas class when the center cell is null', () => {
		const { container } = render(Loupe, {
			props: {
				grid: makeGridWithCenter(OPAQUE_BLUE, null),
				screenPointer: { x: 0, y: 0 },
				viewport: TEST_VIEWPORT,
				inputSource: 'mouse'
			}
		});

		const swatch = container.querySelector('.swatch');
		expect(swatch?.classList.contains('swatch--out-of-canvas')).toBe(true);
		expect(swatch?.classList.contains('swatch--transparent')).toBe(false);
	});

	it('marks the swatch with the swatch--transparent class when the center cell is transparent', () => {
		const { container } = render(Loupe, {
			props: {
				grid: makeGridWithCenter(OPAQUE_BLUE, TRANSPARENT),
				screenPointer: { x: 0, y: 0 },
				viewport: TEST_VIEWPORT,
				inputSource: 'mouse'
			}
		});

		const swatch = container.querySelector('.swatch');
		expect(swatch?.classList.contains('swatch--transparent')).toBe(true);
		expect(swatch?.classList.contains('swatch--out-of-canvas')).toBe(false);
	});

	it('leaves the swatch unmarked when the center cell is opaque', () => {
		const { container } = render(Loupe, {
			props: { grid: makeGrid(OPAQUE_BLUE), screenPointer: { x: 0, y: 0 }, viewport: TEST_VIEWPORT, inputSource: 'mouse' }
		});

		const swatch = container.querySelector('.swatch');
		expect(swatch?.classList.contains('swatch--out-of-canvas')).toBe(false);
		expect(swatch?.classList.contains('swatch--transparent')).toBe(false);
	});

	it('positions itself in the top-right quadrant for mouse with room', () => {
		const { getByTestId } = render(Loupe, {
			props: {
				grid: makeGrid(OPAQUE_BLUE),
				screenPointer: { x: 600, y: 400 },
				viewport: TEST_VIEWPORT,
				inputSource: 'mouse'
			}
		});

		const root = getByTestId('loupe-root') as HTMLElement;
		// Mouse default offset = 20px: x = pointer.x + 20 = 620.
		// Asserting `top < pointer.y` instead of an exact value keeps the test
		// stable if the loupe outer height changes.
		expect(parseFloat(root.style.left)).toBe(620);
		expect(parseFloat(root.style.top)).toBeLessThan(400);
	});

	it('flips horizontally to the top-left quadrant when near the right edge for mouse', () => {
		const { getByTestId } = render(Loupe, {
			props: {
				grid: makeGrid(OPAQUE_BLUE),
				screenPointer: { x: 1180, y: 400 },
				viewport: TEST_VIEWPORT,
				inputSource: 'mouse'
			}
		});

		const root = getByTestId('loupe-root') as HTMLElement;
		// Right-edge pointer flips horizontally — loupe sits to the left of the pointer.
		expect(parseFloat(root.style.left)).toBeLessThan(1180);
	});

	it('centers horizontally on the pointer for touch input', () => {
		const { getByTestId } = render(Loupe, {
			props: {
				grid: makeGrid(OPAQUE_BLUE),
				screenPointer: { x: 600, y: 400 },
				viewport: TEST_VIEWPORT,
				inputSource: 'touch'
			}
		});

		const root = getByTestId('loupe-root') as HTMLElement;
		// Touch centers horizontally: left = pointer.x - loupeWidth / 2.
		// Touch vertical offset is 80px, so the loupe sits well above the pointer.
		expect(parseFloat(root.style.left)).toBeLessThan(600);
		expect(parseFloat(root.style.top)).toBeLessThan(400 - 80);
	});

	it('marks exactly one cell (index 40) as the center cell', () => {
		const { container } = render(Loupe, {
			props: { grid: makeGrid(OPAQUE_BLUE), screenPointer: { x: 0, y: 0 }, viewport: TEST_VIEWPORT, inputSource: 'mouse' }
		});

		const centers = container.querySelectorAll('.cell--center');
		expect(centers.length).toBe(1);
	});

	it('marks null grid cells (out of canvas) with the cell--out-of-canvas class', () => {
		const { container } = render(Loupe, {
			props: {
				grid: makeGridWithNullAt(OPAQUE_BLUE, [0, 1, 9]),
				screenPointer: { x: 0, y: 0 },
				viewport: TEST_VIEWPORT,
				inputSource: 'mouse'
			}
		});

		const cells = container.querySelectorAll('.cell');
		expect(cells[0].classList.contains('cell--out-of-canvas')).toBe(true);
		expect(cells[1].classList.contains('cell--out-of-canvas')).toBe(true);
		expect(cells[9].classList.contains('cell--out-of-canvas')).toBe(true);
		// Opaque cells do not get the class.
		expect(cells[40].classList.contains('cell--out-of-canvas')).toBe(false);
	});

	it('marks transparent grid cells (a=0) with the cell--transparent class', () => {
		const { container } = render(Loupe, {
			props: {
				grid: makeGridWithTransparentAt(OPAQUE_BLUE, [0, 2, 80]),
				screenPointer: { x: 0, y: 0 },
				viewport: TEST_VIEWPORT,
				inputSource: 'mouse'
			}
		});

		const cells = container.querySelectorAll('.cell');
		expect(cells[0].classList.contains('cell--transparent')).toBe(true);
		expect(cells[2].classList.contains('cell--transparent')).toBe(true);
		expect(cells[80].classList.contains('cell--transparent')).toBe(true);
		// Opaque cells do not get the class.
		expect(cells[40].classList.contains('cell--transparent')).toBe(false);
		// And the class is distinct from the out-of-canvas class.
		expect(cells[0].classList.contains('cell--out-of-canvas')).toBe(false);
	});

	it('fills each opaque grid cell with its sampled rgb color', () => {
		const red: Color = { r: 255, g: 0, b: 0, a: 255 };
		const { container } = render(Loupe, {
			props: { grid: makeGrid(red), screenPointer: { x: 0, y: 0 }, viewport: TEST_VIEWPORT, inputSource: 'mouse' }
		});

		const firstCell = container.querySelector('.cell') as HTMLElement;
		// happy-dom normalizes inline color to rgb(...) form.
		expect(firstCell.style.backgroundColor).toBe('rgb(255, 0, 0)');
	});
});
