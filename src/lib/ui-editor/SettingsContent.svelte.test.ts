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
		onFlipHorizontal: vi.fn(),
		onFlipVertical: vi.fn()
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
	it('renders Flip Horizontal and Flip Vertical and invokes their handlers', async () => {
		const { onFlipHorizontal, onFlipVertical } = renderSettings();

		await fireEvent.click(screen.getByRole('button', { name: 'Flip Horizontal' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Flip Vertical' }));

		expect(onFlipHorizontal).toHaveBeenCalledOnce();
		expect(onFlipVertical).toHaveBeenCalledOnce();
	});

	it.each([
		['en', 'Transform', 'Flip Horizontal', 'Flip Vertical'],
		['ko', '변형', '좌우 반전', '상하 반전'],
		['ja', '変形', '左右反転', '上下反転']
	] as const)('renders localized Transform labels for %s', (locale, section, flipH, flipV) => {
		overwriteGetLocale(() => locale);
		renderSettings();

		expect(screen.getByRole('heading', { name: section })).toBeTruthy();
		expect(screen.getByRole('button', { name: flipH })).toBeTruthy();
		expect(screen.getByRole('button', { name: flipV })).toBeTruthy();
	});
});
