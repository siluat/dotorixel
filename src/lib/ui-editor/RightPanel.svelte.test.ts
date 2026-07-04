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
		onFlipCanvasHorizontal: vi.fn(),
		onFlipCanvasVertical: vi.fn(),
		onRotateCanvasCw: vi.fn(),
		onRotateCanvasCcw: vi.fn()
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
	it('renders the canvas-scoped Flip buttons and invokes their handlers', async () => {
		const { onFlipCanvasHorizontal, onFlipCanvasVertical } = renderPanel();

		await fireEvent.click(screen.getByRole('button', { name: 'Flip Canvas Horizontal' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Flip Canvas Vertical' }));

		expect(onFlipCanvasHorizontal).toHaveBeenCalledOnce();
		expect(onFlipCanvasVertical).toHaveBeenCalledOnce();
	});

	it('renders the canvas-scoped Rotate buttons and invokes their handlers', async () => {
		const { onRotateCanvasCw, onRotateCanvasCcw } = renderPanel();

		await fireEvent.click(screen.getByRole('button', { name: 'Rotate Canvas Right' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Rotate Canvas Left' }));

		expect(onRotateCanvasCw).toHaveBeenCalledOnce();
		expect(onRotateCanvasCcw).toHaveBeenCalledOnce();
	});

	it.each([
		['en', 'Transform', 'Flip Canvas Horizontal', 'Rotate Canvas Right'],
		['ko', '변형', '캔버스 좌우 반전', '캔버스 오른쪽 회전'],
		['ja', '変形', 'キャンバス左右反転', 'キャンバス右回転']
	] as const)('renders localized Transform labels for %s', (locale, section, flipH, rotateCw) => {
		overwriteGetLocale(() => locale);
		renderPanel();

		expect(screen.getByRole('heading', { name: section })).toBeTruthy();
		expect(screen.getByRole('button', { name: flipH })).toBeTruthy();
		expect(screen.getByRole('button', { name: rotateCw })).toBeTruthy();
	});
});
