// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/svelte';
import TransportBar from './TransportBar.svelte';

afterEach(() => {
	cleanup();
});

const noop = () => {};

const defaultProps = {
	isPlaying: false,
	isLooping: false,
	position: 1,
	frameCount: 2,
	onTogglePlay: noop,
	onToggleLoop: noop
};

describe('TransportBar', () => {
	it('renders a playback toolbar and fires onTogglePlay when the play control is clicked', async () => {
		const onTogglePlay = vi.fn();
		const { container, getByRole } = render(TransportBar, {
			props: { ...defaultProps, onTogglePlay }
		});

		expect(getByRole('toolbar')).not.toBeNull();

		const play = container.querySelector('[data-transport-play]') as HTMLButtonElement;
		expect(play).not.toBeNull();
		await fireEvent.click(play);
		expect(onTogglePlay).toHaveBeenCalledTimes(1);
	});

	it('fires onToggleLoop when the loop control is clicked', async () => {
		const onToggleLoop = vi.fn();
		const { container } = render(TransportBar, {
			props: { ...defaultProps, onToggleLoop }
		});

		const loop = container.querySelector('[data-transport-loop]') as HTMLButtonElement;
		expect(loop).not.toBeNull();
		await fireEvent.click(loop);
		expect(onToggleLoop).toHaveBeenCalledTimes(1);
	});

	it('shows the Play label while stopped and is not a toggle (no aria-pressed)', () => {
		const { container } = render(TransportBar, {
			props: { ...defaultProps, isPlaying: false }
		});
		const play = container.querySelector('[data-transport-play]') as HTMLButtonElement;
		expect(play.getAttribute('aria-label')).toBe('Play');
		// A dynamic-name action button, not a toggle — aria-pressed would conflict (ARIA APG).
		expect(play.getAttribute('aria-pressed')).toBeNull();
	});

	it('shows the Pause label while playing (still no aria-pressed)', () => {
		const { container } = render(TransportBar, {
			props: { ...defaultProps, isPlaying: true }
		});
		const play = container.querySelector('[data-transport-play]') as HTMLButtonElement;
		expect(play.getAttribute('aria-label')).toBe('Pause');
		expect(play.getAttribute('aria-pressed')).toBeNull();
	});

	it('reflects the loop state via aria-pressed and an on-state class', () => {
		const off = render(TransportBar, { props: { ...defaultProps, isLooping: false } });
		const loopOff = off.container.querySelector('[data-transport-loop]') as HTMLButtonElement;
		expect(loopOff.getAttribute('aria-pressed')).toBe('false');
		expect(loopOff.classList.contains('transport-btn--loop-on')).toBe(false);
		cleanup();

		const on = render(TransportBar, { props: { ...defaultProps, isLooping: true } });
		const loopOn = on.container.querySelector('[data-transport-loop]') as HTMLButtonElement;
		expect(loopOn.getAttribute('aria-pressed')).toBe('true');
		expect(loopOn.classList.contains('transport-btn--loop-on')).toBe(true);
	});

	it('renders the position readout as "n / N"', () => {
		const { container } = render(TransportBar, {
			props: { ...defaultProps, position: 3, frameCount: 12 }
		});
		const readout = container.querySelector('[data-transport-position]') as HTMLElement;
		expect(readout).not.toBeNull();
		expect(readout.textContent?.replace(/\s+/g, ' ').trim()).toBe('3 / 12');
	});

	it('disables play and loop when there is a single frame (nothing to animate)', () => {
		const { container } = render(TransportBar, {
			props: { ...defaultProps, position: 1, frameCount: 1 }
		});
		const play = container.querySelector('[data-transport-play]') as HTMLButtonElement;
		const loop = container.querySelector('[data-transport-loop]') as HTMLButtonElement;
		expect(play.disabled).toBe(true);
		expect(loop.disabled).toBe(true);
	});

	it('enables play and loop with two or more frames', () => {
		const { container } = render(TransportBar, {
			props: { ...defaultProps, frameCount: 2 }
		});
		const play = container.querySelector('[data-transport-play]') as HTMLButtonElement;
		const loop = container.querySelector('[data-transport-loop]') as HTMLButtonElement;
		expect(play.disabled).toBe(false);
		expect(loop.disabled).toBe(false);
	});
});
