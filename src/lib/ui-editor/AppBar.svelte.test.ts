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

function findButtonByLabel(container: HTMLElement, label: string): HTMLButtonElement | null {
	return container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
}

afterEach(() => {
	cleanup();
});

describe('AppBar', () => {
	it('renders browse saved work button when onBrowseSavedWork is provided', () => {
		const onBrowseSavedWork = vi.fn();
		const { container } = renderAppBar({ onBrowseSavedWork });

		expect(findButtonByLabel(container, 'My Works')).toBeTruthy();
	});

	it('does not render browse button when onBrowseSavedWork is not provided', () => {
		const { container } = renderAppBar();

		expect(findButtonByLabel(container, 'My Works')).toBeNull();
	});

	it('calls onBrowseSavedWork when browse button is clicked', async () => {
		const onBrowseSavedWork = vi.fn();
		const { container } = renderAppBar({ onBrowseSavedWork });

		await fireEvent.click(findButtonByLabel(container, 'My Works')!);

		expect(onBrowseSavedWork).toHaveBeenCalledOnce();
	});

	describe('pixel perfect button', () => {
		function findPixelPerfectButton(container: HTMLElement): HTMLButtonElement | null {
			return container.querySelector<HTMLButtonElement>('button[aria-pressed][aria-label*="Pixel Perfect"]');
		}

		it('reflects pixelPerfect=true via aria-pressed', () => {
			const { container } = renderAppBar({ pixelPerfect: true });
			expect(findPixelPerfectButton(container)?.getAttribute('aria-pressed')).toBe('true');
		});

		it('reflects pixelPerfect=false via aria-pressed', () => {
			const { container } = renderAppBar({ pixelPerfect: false });
			expect(findPixelPerfectButton(container)?.getAttribute('aria-pressed')).toBe('false');
		});

		it('omits aria-disabled attribute when enabled', () => {
			const { container } = renderAppBar({ pixelPerfectDisabled: false });
			expect(findPixelPerfectButton(container)?.hasAttribute('aria-disabled')).toBe(false);
		});

		it('sets aria-disabled="true" when disabled', () => {
			const { container } = renderAppBar({ pixelPerfectDisabled: true });
			expect(findPixelPerfectButton(container)?.getAttribute('aria-disabled')).toBe('true');
		});

		it('does not invoke onPixelPerfectToggle when disabled and clicked', async () => {
			const onPixelPerfectToggle = vi.fn();
			const { container } = renderAppBar({
				pixelPerfectDisabled: true,
				onPixelPerfectToggle
			});
			await fireEvent.click(findPixelPerfectButton(container)!);
			expect(onPixelPerfectToggle).not.toHaveBeenCalled();
		});

		it('invokes onPixelPerfectToggle when enabled and clicked', async () => {
			const onPixelPerfectToggle = vi.fn();
			const { container } = renderAppBar({
				pixelPerfectDisabled: false,
				onPixelPerfectToggle
			});
			await fireEvent.click(findPixelPerfectButton(container)!);
			expect(onPixelPerfectToggle).toHaveBeenCalledOnce();
		});
	});
});
