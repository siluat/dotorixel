export type LayoutMode = 'compact' | 'medium' | 'wide' | 'x-wide';

interface LayoutModeState {
	readonly mode: LayoutMode;
	readonly isDocked: boolean;
}

/**
 * Create a reactive layout mode state based on viewport width.
 * Must be called during component initialization (needs `$effect` context).
 *
 * Breakpoints match docs/screen-inventory.md:
 * - compact: <600px (mobile)
 * - medium: 600–1023px (tablet)
 * - wide: 1024–1439px (iPad landscape / laptop)
 * - x-wide: ≥1440px (desktop)
 */
export function createLayoutMode(): LayoutModeState {
	let mode = $state<LayoutMode>('wide');

	$effect(() => {
		const mediumQuery = window.matchMedia('(min-width: 600px)');
		const wideQuery = window.matchMedia('(min-width: 1024px)');
		const xWideQuery = window.matchMedia('(min-width: 1440px)');

		function update() {
			if (xWideQuery.matches) mode = 'x-wide';
			else if (wideQuery.matches) mode = 'wide';
			else if (mediumQuery.matches) mode = 'medium';
			else mode = 'compact';
		}

		update();

		mediumQuery.addEventListener('change', update);
		wideQuery.addEventListener('change', update);
		xWideQuery.addEventListener('change', update);

		return () => {
			mediumQuery.removeEventListener('change', update);
			wideQuery.removeEventListener('change', update);
			xWideQuery.removeEventListener('change', update);
		};
	});

	return {
		get mode() {
			return mode;
		},
		get isDocked() {
			return mode === 'wide' || mode === 'x-wide';
		}
	};
}
