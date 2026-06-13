// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { overwriteGetLocale } from '$lib/paraglide/runtime';
import SettingsContent from './SettingsContent.svelte';
import settingsContentSource from './SettingsContent.svelte?raw';

const defaultProps = {
	canvasWidth: 32,
	canvasHeight: 32,
	showGrid: true,
	resizeAnchor: 'top-left' as const,
	onResize: vi.fn(),
	onExport: vi.fn(),
	onClear: vi.fn(),
	onFlipHorizontal: vi.fn(),
	onFlipVertical: vi.fn(),
	onGridToggle: vi.fn(),
	onAnchorChange: vi.fn()
};

afterEach(() => {
	overwriteGetLocale(() => 'en');
	cleanup();
});

describe('SettingsContent', () => {
	it('renders mobile Transform flip actions and invokes their handlers', async () => {
		const onFlipHorizontal = vi.fn();
		const onFlipVertical = vi.fn();

		render(SettingsContent, {
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

		render(SettingsContent, { props: defaultProps });

		expect(screen.getByRole('heading', { name: section })).toBeTruthy();
		expect(screen.getByRole('button', { name: flipH })).toBeTruthy();
		expect(screen.getByRole('button', { name: flipV })).toBeTruthy();
	});

	it('keeps Transform controls touch-sized and responsive', () => {
		expect(settingsContentSource).toContain('height: 44px');
		expect(settingsContentSource).toContain(
			'grid-template-columns: repeat(auto-fit, minmax(132px, 1fr))'
		);
	});
});
