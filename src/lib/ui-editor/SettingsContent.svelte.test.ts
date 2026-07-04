// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import SettingsContent from './SettingsContent.svelte';
import { overwriteGetLocale } from '$lib/paraglide/runtime';

function renderSettings(props: Record<string, unknown> = {}) {
	const defaultProps = {
		canvasWidth: 32,
		canvasHeight: 32,
		showGrid: true,
		resizeAnchor: 'top-left' as const,
		onResize: vi.fn(),
		onExport: vi.fn(),
		onClear: vi.fn(),
		onGridToggle: vi.fn(),
		onAnchorChange: vi.fn(),
		onFlipCanvasHorizontal: vi.fn(),
		onFlipCanvasVertical: vi.fn(),
		onRotateCw: vi.fn(),
		onRotateCcw: vi.fn()
	};
	const merged = { ...defaultProps, ...props };
	const result = render(SettingsContent, { props: merged });
	return { ...result, ...merged };
}

afterEach(() => {
	overwriteGetLocale(() => 'en');
	cleanup();
});

describe('SettingsContent — Transform group', () => {
	it('renders the canvas-scoped Flip buttons and invokes their handlers', async () => {
		const { onFlipCanvasHorizontal, onFlipCanvasVertical } = renderSettings();

		await fireEvent.click(screen.getByRole('button', { name: 'Flip Canvas Horizontal' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Flip Canvas Vertical' }));

		expect(onFlipCanvasHorizontal).toHaveBeenCalledOnce();
		expect(onFlipCanvasVertical).toHaveBeenCalledOnce();
	});

	it('renders Rotate Right and Rotate Left and invokes their handlers', async () => {
		const { onRotateCw, onRotateCcw } = renderSettings();

		await fireEvent.click(screen.getByRole('button', { name: 'Rotate Right' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Rotate Left' }));

		expect(onRotateCw).toHaveBeenCalledOnce();
		expect(onRotateCcw).toHaveBeenCalledOnce();
	});

	it.each([
		['en', 'Transform', 'Flip Canvas Horizontal', 'Flip Canvas Vertical'],
		['ko', '변형', '캔버스 좌우 반전', '캔버스 상하 반전'],
		['ja', '変形', 'キャンバス左右反転', 'キャンバス上下反転']
	] as const)('renders localized Transform labels for %s', (locale, section, flipH, flipV) => {
		overwriteGetLocale(() => locale);
		renderSettings();

		expect(screen.getByRole('heading', { name: section })).toBeTruthy();
		expect(screen.getByRole('button', { name: flipH })).toBeTruthy();
		expect(screen.getByRole('button', { name: flipV })).toBeTruthy();
	});
});
