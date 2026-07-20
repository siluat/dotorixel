// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import HsvPicker from './HsvPicker.svelte';

// The picker paints to a 2D canvas context that happy-dom does not implement.
// A permissive stub lets the component mount so keyboard behavior can be
// exercised.
function stub2dContext(): CanvasRenderingContext2D {
	const gradient = { addColorStop: vi.fn() };
	return new Proxy(
		{},
		{
			get(_target, prop) {
				if (prop === 'createLinearGradient' || prop === 'createRadialGradient') {
					return () => gradient;
				}
				return vi.fn();
			}
		}
	) as unknown as CanvasRenderingContext2D;
}

beforeEach(() => {
	vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(stub2dContext());
});

afterEach(() => {
	vi.restoreAllMocks();
	cleanup();
});

/**
 * Renders the picker under the real parent contract: the picker is a
 * controlled component, so each emitted color is echoed back into
 * `selectedColor` (as `RightPanel` does) before the next interaction.
 */
function renderPicker(selectedColor = '#ff8080') {
	const onColorChange = vi.fn();
	const { rerender } = render(HsvPicker, { props: { selectedColor, onColorChange } });

	async function pressKey(el: HTMLElement, key: string, init: KeyboardEventInit = {}) {
		await fireEvent.keyDown(el, { key, ...init });
		const emitted = onColorChange.mock.lastCall?.[0];
		if (emitted) await rerender({ selectedColor: emitted });
	}

	return {
		onColorChange,
		pressKey,
		svArea: screen.getByRole('slider', { name: 'Saturation and brightness' }),
		hueStrip: screen.getByRole('slider', { name: 'Hue' })
	};
}

// #ff8080 → h=0, s≈0.498 (aria 50%), v=1 (100%)
describe('HsvPicker keyboard interaction — SV area', () => {
	it('ArrowRight increases saturation by 1% and emits the new color', async () => {
		const { svArea, onColorChange, pressKey } = renderPicker();

		await pressKey(svArea, 'ArrowRight');

		// s 0.498 + 0.01 → hsv(0, 0.508, 1) → #ff7d7d
		expect(onColorChange).toHaveBeenCalledWith('#ff7d7d');
		expect(svArea.getAttribute('aria-valuenow')).toBe('51');
	});

	it('ArrowLeft decreases saturation, ArrowUp/ArrowDown adjust brightness', async () => {
		const { svArea, onColorChange, pressKey } = renderPicker();

		await pressKey(svArea, 'ArrowLeft');
		// s 0.498 - 0.01 → hsv(0, 0.488, 1) → #ff8383
		expect(onColorChange).toHaveBeenLastCalledWith('#ff8383');

		await pressKey(svArea, 'ArrowDown');
		// v 1 - 0.01 → hsv(0, ~0.486, 0.99) → #fc8282
		expect(onColorChange).toHaveBeenLastCalledWith('#fc8282');

		await pressKey(svArea, 'ArrowUp');
		// v back up to 1 → #ff8383
		expect(onColorChange).toHaveBeenLastCalledWith('#ff8383');
	});

	it('Shift-modified arrows step by 10%', async () => {
		const { svArea, onColorChange, pressKey } = renderPicker();

		await pressKey(svArea, 'ArrowRight', { shiftKey: true });
		// s 0.498 + 0.1 → #ff6767
		expect(onColorChange).toHaveBeenLastCalledWith('#ff6767');

		await pressKey(svArea, 'ArrowDown', { shiftKey: true });
		// v 1 - 0.1 (s re-derived from #ff6767) → #e65d5d
		expect(onColorChange).toHaveBeenLastCalledWith('#e65d5d');
	});

	it('clamps at the upper range ends without wrapping', async () => {
		// #ff0000 → s=1 (100%), v=1 (100%)
		const { svArea, pressKey } = renderPicker('#ff0000');

		await pressKey(svArea, 'ArrowRight', { shiftKey: true });
		await pressKey(svArea, 'ArrowUp', { shiftKey: true });

		expect(svArea.getAttribute('aria-valuenow')).toBe('100');
		expect(svArea.getAttribute('aria-valuetext')).toBe('Saturation 100%, Brightness 100%');
	});

	it('clamps at the lower range ends without wrapping', async () => {
		// #000000 → s=0 (0%), v=0 (0%)
		const { svArea, pressKey } = renderPicker('#000000');

		await pressKey(svArea, 'ArrowLeft', { shiftKey: true });
		await pressKey(svArea, 'ArrowDown', { shiftKey: true });

		expect(svArea.getAttribute('aria-valuenow')).toBe('0');
		expect(svArea.getAttribute('aria-valuetext')).toBe('Saturation 0%, Brightness 0%');
	});
});

describe('HsvPicker keyboard interaction — hue strip', () => {
	it('ArrowDown/ArrowUp adjust hue by 1° following the visual direction', async () => {
		const { hueStrip, onColorChange, pressKey } = renderPicker();

		// The strip runs top (0°) to bottom (360°), so ArrowDown increases hue.
		await pressKey(hueStrip, 'ArrowDown');
		// h 0 + 1 → #ff8280
		expect(onColorChange).toHaveBeenLastCalledWith('#ff8280');
		expect(hueStrip.getAttribute('aria-valuenow')).toBe('1');

		await pressKey(hueStrip, 'ArrowUp');
		expect(hueStrip.getAttribute('aria-valuenow')).toBe('0');
	});

	it('Shift-modified arrows step hue by 10° and clamp at 0°', async () => {
		const { hueStrip, onColorChange, pressKey } = renderPicker();

		await pressKey(hueStrip, 'ArrowDown', { shiftKey: true });
		// h 0 + 10 → #ff9580
		expect(onColorChange).toHaveBeenLastCalledWith('#ff9580');

		await pressKey(hueStrip, 'ArrowUp', { shiftKey: true });
		await pressKey(hueStrip, 'ArrowUp', { shiftKey: true });
		// clamped at 0°, no wrap to 350°
		expect(hueStrip.getAttribute('aria-valuenow')).toBe('0');
	});
});

describe('HsvPicker keyboard interaction — default handling', () => {
	it('prevents default only for handled arrow keys, letting Tab pass through', async () => {
		const { svArea, hueStrip } = renderPicker();

		// fireEvent resolves to false when preventDefault() was called.
		await expect(fireEvent.keyDown(svArea, { key: 'ArrowRight' })).resolves.toBe(false);
		await expect(fireEvent.keyDown(hueStrip, { key: 'ArrowDown' })).resolves.toBe(false);

		await expect(fireEvent.keyDown(svArea, { key: 'Tab' })).resolves.toBe(true);
		await expect(fireEvent.keyDown(hueStrip, { key: 'Tab' })).resolves.toBe(true);
	});
});

describe('HsvPicker slider semantics', () => {
	it('exposes complete range metadata on both sliders', async () => {
		const { svArea, hueStrip, pressKey } = renderPicker();

		expect(svArea.getAttribute('aria-valuemin')).toBe('0');
		expect(svArea.getAttribute('aria-valuemax')).toBe('100');

		expect(hueStrip.getAttribute('aria-orientation')).toBe('vertical');
		expect(hueStrip.getAttribute('aria-valuetext')).toBe('0 degrees');
		await pressKey(hueStrip, 'ArrowDown', { shiftKey: true });
		expect(hueStrip.getAttribute('aria-valuetext')).toBe('10 degrees');
	});
});
