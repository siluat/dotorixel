// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import type { MarqueeRegion } from '$lib/canvas/canvas-model';
import { overwriteGetLocale } from '$lib/paraglide/runtime';
import StatusBar from './StatusBar.svelte';

function makeMarquee(
	overrides: Partial<Pick<MarqueeRegion, 'x' | 'y' | 'width' | 'height'>> = {}
): MarqueeRegion {
	const marquee: MarqueeRegion = {
		x: 3,
		y: 5,
		width: 12,
		height: 8,
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

describe('StatusBar', () => {
	it('hides the Marquee readout when no Marquee is active', () => {
		const { container, queryByText } = render(StatusBar, {
			props: {
				canvasWidth: 32,
				canvasHeight: 32,
				activeTool: 'selection',
				layoutMode: 'medium'
			}
		});

		expect(container.querySelector('.status-marquee')).toBeNull();
		expect(queryByText(/Marquee:/)).toBeNull();
	});

	it('renders the active Marquee readout in medium and larger layouts', () => {
		const { getByText } = render(StatusBar, {
			props: {
				canvasWidth: 32,
				canvasHeight: 32,
				activeTool: 'selection',
				layoutMode: 'medium',
				marquee: makeMarquee()
			}
		});

		expect(getByText('Marquee: 12×8 at (3, 5)')).toBeTruthy();
	});

	it('renders only Marquee dimensions in compact layout', () => {
		const { getByText, queryByText } = render(StatusBar, {
			props: {
				canvasWidth: 32,
				canvasHeight: 32,
				activeTool: 'selection',
				layoutMode: 'compact',
				marquee: makeMarquee()
			}
		});

		expect(getByText('12×8')).toBeTruthy();
		expect(queryByText(/Marquee:/)).toBeNull();
		expect(queryByText(/\(3, 5\)/)).toBeNull();
	});

	it('renders the Marquee readout with the active locale template', () => {
		overwriteGetLocale(() => 'ko');

		const { getByText } = render(StatusBar, {
			props: {
				canvasWidth: 32,
				canvasHeight: 32,
				activeTool: 'selection',
				layoutMode: 'medium',
				marquee: makeMarquee()
			}
		});

		expect(getByText('선택 영역: 12×8 (3, 5)')).toBeTruthy();
	});
});
