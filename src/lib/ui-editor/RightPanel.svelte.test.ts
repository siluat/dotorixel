// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { overwriteGetLocale } from '$lib/paraglide/runtime';
import RightPanel from './RightPanel.svelte';

const defaultProps = {
	foregroundColor: '#2D210F',
	backgroundColor: '#FFFFFF',
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
	onFlipVertical: vi.fn()
};

beforeEach(() => {
	const gradient = { addColorStop: vi.fn() };
	vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
		createLinearGradient: () => gradient,
		fillRect: vi.fn()
	} as unknown as CanvasRenderingContext2D);
});

afterEach(() => {
	overwriteGetLocale(() => 'en');
	vi.restoreAllMocks();
	cleanup();
});

describe('RightPanel', () => {
	it('renders Transform flip actions and invokes their handlers', async () => {
		const onFlipHorizontal = vi.fn();
		const onFlipVertical = vi.fn();

		render(RightPanel, {
			props: {
				...defaultProps,
				onFlipHorizontal,
				onFlipVertical
			}
		});

		expect(screen.getByRole('heading', { name: 'Transform' })).toBeTruthy();

		await fireEvent.click(screen.getByRole('button', { name: 'Flip H' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Flip V' }));

		expect(onFlipHorizontal).toHaveBeenCalledOnce();
		expect(onFlipVertical).toHaveBeenCalledOnce();
	});

	it.each([
		['en', 'Transform', 'Flip H', 'Flip V'],
		['ko', '변형', '좌우 반전', '상하 반전'],
		['ja', '変形', '左右反転', '上下反転']
	] as const)('renders localized Transform labels for %s', (locale, section, flipH, flipV) => {
		overwriteGetLocale(() => locale);

		render(RightPanel, { props: defaultProps });

		expect(screen.getByRole('heading', { name: section })).toBeTruthy();
		expect(screen.getByRole('button', { name: flipH })).toBeTruthy();
		expect(screen.getByRole('button', { name: flipV })).toBeTruthy();
	});
});
