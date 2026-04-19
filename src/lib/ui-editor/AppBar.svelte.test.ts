// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/svelte';
import AppBar from './AppBar.svelte';

function renderAppBar(props: Record<string, unknown> = {}) {
	const defaults = {
		activeTab: 'draw' as const,
		showGrid: false,
		pixelPerfect: true,
		pixelPerfectDisabled: false,
		zoomPercent: 100,
		onGridToggle: vi.fn(),
		onPixelPerfectToggle: vi.fn(),
		onExport: vi.fn(),
		onZoomIn: vi.fn(),
		onZoomOut: vi.fn(),
		onZoomReset: vi.fn()
	};
	const merged = { ...defaults, ...props };
	const result = render(AppBar, { props: merged });
	return { ...result, ...merged };
}

afterEach(() => {
	cleanup();
});

describe('AppBar', () => {
	it('renders browse saved work button when onBrowseSavedWork is provided', () => {
		const onBrowseSavedWork = vi.fn();
		const { container } = renderAppBar({ onBrowseSavedWork });

		const allButtons = container.querySelectorAll('.action-btn');
		const browseButton = [...allButtons].find(
			(btn) => btn.getAttribute('aria-label') === 'My Works'
		);
		expect(browseButton).toBeTruthy();
	});

	it('does not render browse button when onBrowseSavedWork is not provided', () => {
		const { container } = renderAppBar();

		const allButtons = container.querySelectorAll('.action-btn');
		const browseButton = [...allButtons].find(
			(btn) => btn.getAttribute('aria-label') === 'My Works'
		);
		expect(browseButton).toBeUndefined();
	});

	it('calls onBrowseSavedWork when browse button is clicked', async () => {
		const onBrowseSavedWork = vi.fn();
		const { container } = renderAppBar({ onBrowseSavedWork });

		const allButtons = container.querySelectorAll('.action-btn');
		const browseButton = [...allButtons].find(
			(btn) => btn.getAttribute('aria-label') === 'My Works'
		);
		await fireEvent.click(browseButton!);

		expect(onBrowseSavedWork).toHaveBeenCalledOnce();
	});

	describe('pixel perfect button', () => {
		it('reflects pixelPerfect=true via aria-pressed', () => {
			const { container } = renderAppBar({ pixelPerfect: true });
			const ppButton = container.querySelector('.pp-btn');
			expect(ppButton?.getAttribute('aria-pressed')).toBe('true');
		});

		it('reflects pixelPerfect=false via aria-pressed', () => {
			const { container } = renderAppBar({ pixelPerfect: false });
			const ppButton = container.querySelector('.pp-btn');
			expect(ppButton?.getAttribute('aria-pressed')).toBe('false');
		});

		it('omits aria-disabled attribute when enabled', () => {
			const { container } = renderAppBar({ pixelPerfectDisabled: false });
			const ppButton = container.querySelector('.pp-btn');
			expect(ppButton?.hasAttribute('aria-disabled')).toBe(false);
		});

		it('sets aria-disabled="true" when disabled', () => {
			const { container } = renderAppBar({ pixelPerfectDisabled: true });
			const ppButton = container.querySelector('.pp-btn');
			expect(ppButton?.getAttribute('aria-disabled')).toBe('true');
		});

		it('does not invoke onPixelPerfectToggle when disabled and clicked', async () => {
			const onPixelPerfectToggle = vi.fn();
			const { container } = renderAppBar({
				pixelPerfectDisabled: true,
				onPixelPerfectToggle
			});
			const ppButton = container.querySelector('.pp-btn');
			await fireEvent.click(ppButton!);
			expect(onPixelPerfectToggle).not.toHaveBeenCalled();
		});

		it('invokes onPixelPerfectToggle when enabled and clicked', async () => {
			const onPixelPerfectToggle = vi.fn();
			const { container } = renderAppBar({
				pixelPerfectDisabled: false,
				onPixelPerfectToggle
			});
			const ppButton = container.querySelector('.pp-btn');
			await fireEvent.click(ppButton!);
			expect(onPixelPerfectToggle).toHaveBeenCalledOnce();
		});
	});
});
