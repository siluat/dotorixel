// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MarqueeRegion } from './canvas-model';
import type { ViewportData } from './viewport';
import SelectionActionBar from './SelectionActionBar.svelte';
import selectionActionBarSource from './SelectionActionBar.svelte?raw';
import { overwriteGetLocale } from '$lib/paraglide/runtime';

const viewport: ViewportData = {
	pixelSize: 10,
	zoom: 1,
	panX: 4.2,
	panY: 5.6,
	showGrid: false,
	gridColor: '#000000'
};

function region(overrides: Partial<MarqueeRegion> = {}): MarqueeRegion {
	const marquee: MarqueeRegion = {
		x: 2,
		y: 6,
		width: 4,
		height: 3,
		contains: () => false,
		translate: () => marquee,
		clip_to: () => marquee,
		...overrides
	};
	return marquee;
}

afterEach(() => {
	overwriteGetLocale(() => 'en');
	cleanup();
});

describe('SelectionActionBar', () => {
	it('renders Idle selection commands when a Marquee is active without a Floating Selection', async () => {
		const handlers = {
			onCopySelection: vi.fn(),
			onCutSelection: vi.fn(),
			onPasteSelectionClipboard: vi.fn(),
			onDeleteMarqueePixels: vi.fn(),
			onClearMarqueeOrFloating: vi.fn()
		};

		render(SelectionActionBar, {
			props: {
				marquee: region(),
				canvasWidth: 12,
				canvasHeight: 12,
				viewport,
				viewportSize: { width: 180, height: 180 },
				canPaste: true,
				...handlers
			}
		});

		expect(screen.getByRole('group', { name: 'Selection actions' })).toBeTruthy();

		await fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Cut' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Paste' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Deselect' }));

		expect(handlers.onCopySelection).toHaveBeenCalledOnce();
		expect(handlers.onCutSelection).toHaveBeenCalledOnce();
		expect(handlers.onPasteSelectionClipboard).toHaveBeenCalledOnce();
		expect(handlers.onDeleteMarqueePixels).toHaveBeenCalledOnce();
		expect(handlers.onClearMarqueeOrFloating).toHaveBeenCalledOnce();
	});

	it('disables Paste when the shared Selection Clipboard is empty', async () => {
		const onPasteSelectionClipboard = vi.fn();

		render(SelectionActionBar, {
			props: {
				marquee: region(),
				canvasWidth: 12,
				canvasHeight: 12,
				viewport,
				viewportSize: { width: 180, height: 180 },
				canPaste: false,
				onPasteSelectionClipboard
			}
		});

		const paste = screen.getByRole('button', { name: 'Paste' });
		expect(paste.hasAttribute('disabled')).toBe(true);

		await fireEvent.click(paste);

		expect(onPasteSelectionClipboard).not.toHaveBeenCalled();
	});

	it('does not render for a Floating Selection', () => {
		render(SelectionActionBar, {
			props: {
				marquee: region(),
				floatingSelectionOffset: { dx: 1, dy: 1 },
				canvasWidth: 12,
				canvasHeight: 12,
				viewport,
				viewportSize: { width: 180, height: 180 },
				canPaste: true
			}
		});

		expect(screen.queryByRole('group', { name: 'Selection actions' })).toBeNull();
	});

	it('does not render when the projected Marquee is smaller than one screen pixel', () => {
		render(SelectionActionBar, {
			props: {
				marquee: region(),
				canvasWidth: 12,
				canvasHeight: 12,
				viewport: { ...viewport, pixelSize: 1, zoom: 0.25 },
				viewportSize: { width: 180, height: 180 },
				canPaste: true
			}
		});

		expect(screen.queryByRole('group', { name: 'Selection actions' })).toBeNull();
	});

	it('positions above the Marquee when the viewport has room', () => {
		render(SelectionActionBar, {
			props: {
				marquee: region({ x: 2, y: 2, width: 4, height: 2 }),
				canvasWidth: 12,
				canvasHeight: 12,
				viewport: { ...viewport, panX: 0, panY: 80 },
				viewportSize: { width: 240, height: 200 },
				canPaste: true
			}
		});

		const bar = screen.getByTestId('selection-action-bar');
		expect(bar.style.top).toBe('48px');
	});

	it('falls back below the Marquee when the top placement overflows', () => {
		render(SelectionActionBar, {
			props: {
				marquee: region({ x: 2, y: 1, width: 4, height: 2 }),
				canvasWidth: 12,
				canvasHeight: 12,
				viewport: { ...viewport, panX: 0, panY: 0 },
				viewportSize: { width: 240, height: 200 },
				canPaste: true
			}
		});

		const bar = screen.getByTestId('selection-action-bar');
		expect(bar.style.top).toBe('38px');
	});

	it('sticks to the closest viewport edge when both vertical placements overflow', () => {
		render(SelectionActionBar, {
			props: {
				marquee: region({ x: 0, y: 0, width: 12, height: 12 }),
				canvasWidth: 12,
				canvasHeight: 12,
				viewport: { ...viewport, panX: 0, panY: 0 },
				viewportSize: { width: 120, height: 64 },
				canPaste: true
			}
		});

		const bar = screen.getByTestId('selection-action-bar');
		expect(bar.style.top).toBe('0px');
	});

	it('clamps to the left viewport edge when the Marquee is near the left edge', () => {
		render(SelectionActionBar, {
			props: {
				marquee: region({ x: 0, y: 8, width: 1, height: 1 }),
				canvasWidth: 24,
				canvasHeight: 12,
				viewport: { ...viewport, panX: 0, panY: 0 },
				viewportSize: { width: 240, height: 200 },
				canPaste: true
			}
		});

		expect(screen.getByTestId('selection-action-bar').style.left).toBe('8px');
	});

	it('clamps to the right viewport edge when the Marquee is near the right edge', () => {
		render(SelectionActionBar, {
			props: {
				marquee: region({ x: 23, y: 8, width: 1, height: 1 }),
				canvasWidth: 24,
				canvasHeight: 12,
				viewport: { ...viewport, panX: 0, panY: 0 },
				viewportSize: { width: 240, height: 200 },
				canPaste: true
			}
		});

		expect(screen.getByTestId('selection-action-bar').style.left).toBe('34px');
	});

	it('hides during pointer drag and restores after release state', async () => {
		const { rerender } = render(SelectionActionBar, {
			props: {
				marquee: region(),
				canvasWidth: 12,
				canvasHeight: 12,
				viewport,
				viewportSize: { width: 180, height: 180 },
				canPaste: true,
				isDragging: true
			}
		});

		expect(
			screen
				.getByTestId('selection-action-bar')
				.classList.contains('selection-action-bar--hidden')
		).toBe(true);

		await rerender({
			marquee: region(),
			canvasWidth: 12,
			canvasHeight: 12,
			viewport,
			viewportSize: { width: 180, height: 180 },
			canPaste: true,
			isDragging: false
		});

		expect(
			screen
				.getByTestId('selection-action-bar')
				.classList.contains('selection-action-bar--hidden')
		).toBe(false);
	});

	it('renders icon-only commands on compact viewports and labels on medium viewports', async () => {
		const { rerender } = render(SelectionActionBar, {
			props: {
				marquee: region(),
				canvasWidth: 12,
				canvasHeight: 12,
				viewport,
				viewportSize: { width: 320, height: 180 },
				canPaste: true
			}
		});

		expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy();
		expect(screen.queryByText('Copy')).toBeNull();

		await rerender({
			marquee: region(),
			canvasWidth: 12,
			canvasHeight: 12,
			viewport,
			viewportSize: { width: 600, height: 180 },
			canPaste: true
		});

		expect(screen.getByText('Copy')).toBeTruthy();
	});

	it.each([
		['en', 'Copy', 'Cut', 'Paste', 'Delete', 'Deselect'],
		['ko', '복사', '잘라내기', '붙여넣기', '삭제', '선택 해제'],
		['ja', 'コピー', '切り取り', '貼り付け', '削除', '選択解除']
	] as const)(
		'renders localized labels for %s',
		(locale, copy, cut, paste, deleteLabel, deselect) => {
			overwriteGetLocale(() => locale);

			render(SelectionActionBar, {
				props: {
					marquee: region(),
					canvasWidth: 12,
					canvasHeight: 12,
					viewport,
					viewportSize: { width: 600, height: 180 },
					canPaste: true
				}
			});

			for (const label of [copy, cut, paste, deleteLabel, deselect]) {
				expect(screen.getByRole('button', { name: label })).toBeTruthy();
			}
		}
	);

	it('documents fade timing, reduced motion, and compact touch target CSS', () => {
		expect(selectionActionBarSource).toContain('transition: opacity 120ms ease-out');
		expect(selectionActionBarSource).toContain('transition-duration: 100ms');
		expect(selectionActionBarSource).toContain('prefers-reduced-motion: reduce');
		expect(selectionActionBarSource).toContain('width: 44px');
		expect(selectionActionBarSource).toContain('height: 44px');
	});
});
