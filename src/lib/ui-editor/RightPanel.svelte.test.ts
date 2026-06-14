// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import RightPanel from './RightPanel.svelte';
import { overwriteGetLocale } from '$lib/paraglide/runtime';

// The Color section's HsvPicker paints to a 2D canvas context that happy-dom
// does not implement. A permissive stub lets the panel mount so the Transform
// group can be exercised.
function stub2dContext(): CanvasRenderingContext2D {
	const gradient = { addColorStop: vi.fn() };
	return new Proxy(
		{},
		{
			get(_target, prop) {
				if (prop === 'createLinearGradient' || prop === 'createRadialGradient') {
					return () => gradient;
				}
				if (prop === 'createImageData' || prop === 'getImageData') {
					return (w = 1, h = 1) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h });
				}
				return vi.fn();
			}
		}
	) as unknown as CanvasRenderingContext2D;
}

beforeEach(() => {
	vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(stub2dContext());
});

function renderPanel(props: Record<string, unknown> = {}) {
	const defaultProps = {
		foregroundColor: '#000000',
		backgroundColor: '#ffffff',
		recentColors: [],
		canvasWidth: 32,
		canvasHeight: 32,
		resizeAnchor: 'top-left' as const,
		onForegroundColorChange: vi.fn(),
		onBackgroundColorChange: vi.fn(),
		onSwapColors: vi.fn(),
		onResize: vi.fn(),
		onClear: vi.fn(),
		onAnchorChange: vi.fn(),
		onFlipHorizontal: vi.fn(),
		onFlipVertical: vi.fn(),
		onRotateCw: vi.fn(),
		onRotateCcw: vi.fn()
	};
	const merged = { ...defaultProps, ...props };
	const result = render(RightPanel, { props: merged });
	return { ...result, ...merged };
}

afterEach(() => {
	overwriteGetLocale(() => 'en');
	vi.restoreAllMocks();
	cleanup();
});

describe('RightPanel — Transform group', () => {
	it('renders Flip Horizontal and Flip Vertical and invokes their handlers', async () => {
		const { onFlipHorizontal, onFlipVertical } = renderPanel();

		await fireEvent.click(screen.getByRole('button', { name: 'Flip Horizontal' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Flip Vertical' }));

		expect(onFlipHorizontal).toHaveBeenCalledOnce();
		expect(onFlipVertical).toHaveBeenCalledOnce();
	});

	it('renders Rotate Right and Rotate Left and invokes their handlers', async () => {
		const { onRotateCw, onRotateCcw } = renderPanel();

		await fireEvent.click(screen.getByRole('button', { name: 'Rotate Right' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Rotate Left' }));

		expect(onRotateCw).toHaveBeenCalledOnce();
		expect(onRotateCcw).toHaveBeenCalledOnce();
	});

	it.each([
		['en', 'Transform', 'Flip Horizontal', 'Flip Vertical'],
		['ko', '변형', '좌우 반전', '상하 반전'],
		['ja', '変形', '左右反転', '上下反転']
	] as const)('renders localized Transform labels for %s', (locale, section, flipH, flipV) => {
		overwriteGetLocale(() => locale);
		renderPanel();

		expect(screen.getByRole('heading', { name: section })).toBeTruthy();
		expect(screen.getByRole('button', { name: flipH })).toBeTruthy();
		expect(screen.getByRole('button', { name: flipV })).toBeTruthy();
	});
});
