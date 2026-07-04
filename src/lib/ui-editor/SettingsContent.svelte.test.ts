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
		onRotateCanvasCw: vi.fn(),
		onRotateCanvasCcw: vi.fn()
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

	it('renders the canvas-scoped Rotate buttons and invokes their handlers', async () => {
		const { onRotateCanvasCw, onRotateCanvasCcw } = renderSettings();

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
		renderSettings();

		expect(screen.getByRole('heading', { name: section })).toBeTruthy();
		expect(screen.getByRole('button', { name: flipH })).toBeTruthy();
		expect(screen.getByRole('button', { name: rotateCw })).toBeTruthy();
	});
});
