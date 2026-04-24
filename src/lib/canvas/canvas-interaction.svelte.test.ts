import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	createCanvasInteraction,
	type CanvasInteractionOptions,
	type CanvasInteractionCallbacks
} from './canvas-interaction.svelte';
import { viewportOps } from './wasm-backend';

function setup(overrides?: {
	options?: Partial<CanvasInteractionOptions>;
	callbacks?: Partial<CanvasInteractionCallbacks>;
}) {
	const callbacks: CanvasInteractionCallbacks = {
		onDrawStart: vi.fn(),
		onDraw: vi.fn(),
		onDrawEnd: vi.fn(),
		onViewportChange: vi.fn(),
		onSampleStart: vi.fn(() => true),
		onSampleUpdate: vi.fn(),
		onSampleEnd: vi.fn(),
		onSampleCancel: vi.fn(),
		...overrides?.callbacks
	};
	let spaceHeld = false;
	const viewport = viewportOps.forCanvas(16, 16); // pixel_size=32
	const options: CanvasInteractionOptions = {
		screenToCanvas: (x, y) => viewportOps.screenToCanvas(viewport, x, y),
		getViewport: () => viewport,
		isSpaceHeld: () => spaceHeld,
		...overrides?.options
	};
	const interaction = createCanvasInteraction(options, callbacks);
	return {
		interaction,
		callbacks,
		setSpaceHeld: (v: boolean) => {
			spaceHeld = v;
		}
	};
}

// ── Drawing ────────────────────────────────────────────────────

describe('drawing', () => {
	it('left click starts drawing and paints first pixel', () => {
		const { interaction, callbacks } = setup();
		interaction.pointerDown(1, 50, 50, 'mouse', 0);

		expect(callbacks.onDrawStart).toHaveBeenCalledOnce();
		expect(callbacks.onDraw).toHaveBeenCalledOnce();
		expect(interaction.interactionType).toBe('drawing');
	});

	it('pointer move continues drawing with previous coords', () => {
		const { interaction, callbacks } = setup();
		interaction.pointerDown(1, 0, 0, 'mouse', 0);

		interaction.pointerMove(32, 0);

		expect(callbacks.onDraw).toHaveBeenCalledTimes(2);
		expect(callbacks.onDraw).toHaveBeenLastCalledWith({ x: 1, y: 0 }, { x: 0, y: 0 });
	});

	it('skips duplicate coordinates', () => {
		const { interaction, callbacks } = setup();
		interaction.pointerDown(1, 0, 0, 'mouse', 0);

		interaction.pointerMove(0, 0);

		expect(callbacks.onDraw).toHaveBeenCalledTimes(1);
	});

	it('pointer up ends drawing', () => {
		const { interaction, callbacks } = setup();
		interaction.pointerDown(1, 50, 50, 'mouse', 0);

		interaction.pointerUp(1, 50, 50);

		expect(callbacks.onDrawEnd).toHaveBeenCalledOnce();
		expect(interaction.interactionType).toBe('idle');
	});

	it('pointer leave draws final pixel and ends drawing', () => {
		const { interaction, callbacks } = setup();
		interaction.pointerDown(1, 0, 0, 'mouse', 0);

		interaction.pointerLeave(32, 0);

		expect(callbacks.onDraw).toHaveBeenCalledTimes(2);
		expect(callbacks.onDrawEnd).toHaveBeenCalledOnce();
		expect(interaction.interactionType).toBe('idle');
	});

	it('right click starts drawing', () => {
		const { interaction, callbacks } = setup();
		interaction.pointerDown(1, 50, 50, 'mouse', 2);

		expect(callbacks.onDrawStart).toHaveBeenCalledOnce();
		expect(callbacks.onDrawStart).toHaveBeenCalledWith(2, 'mouse');
		expect(callbacks.onDraw).toHaveBeenCalledOnce();
		expect(interaction.interactionType).toBe('drawing');
	});

	it('left click passes button 0 to onDrawStart', () => {
		const { interaction, callbacks } = setup();
		interaction.pointerDown(1, 50, 50, 'mouse', 0);

		expect(callbacks.onDrawStart).toHaveBeenCalledWith(0, 'mouse');
	});

	it('right click drawing continues with pointer move', () => {
		const { interaction, callbacks } = setup();
		interaction.pointerDown(1, 0, 0, 'mouse', 2);

		interaction.pointerMove(32, 0);

		expect(callbacks.onDraw).toHaveBeenCalledTimes(2);
		expect(callbacks.onDraw).toHaveBeenLastCalledWith({ x: 1, y: 0 }, { x: 0, y: 0 });
	});

	it('right click drawing ends on pointer up', () => {
		const { interaction, callbacks } = setup();
		interaction.pointerDown(1, 50, 50, 'mouse', 2);

		interaction.pointerUp(1, 50, 50);

		expect(callbacks.onDrawEnd).toHaveBeenCalledOnce();
		expect(interaction.interactionType).toBe('idle');
	});

	it('button 3 does not start drawing', () => {
		const { interaction, callbacks } = setup();
		interaction.pointerDown(1, 50, 50, 'mouse', 3);

		expect(callbacks.onDrawStart).not.toHaveBeenCalled();
		expect(interaction.interactionType).toBe('idle');
	});

	it('ignores pointer down when not idle', () => {
		const { interaction, callbacks } = setup();
		interaction.pointerDown(1, 50, 50, 'mouse', 0);

		interaction.pointerDown(1, 100, 100, 'mouse', 0);

		expect(callbacks.onDrawStart).toHaveBeenCalledTimes(1);
	});

	it('pointer move is ignored when not drawing', () => {
		const { interaction, callbacks } = setup();
		interaction.pointerMove(50, 50);

		expect(callbacks.onDraw).not.toHaveBeenCalled();
	});
});

// ── Panning ────────────────────────────────────────────────────

describe('panning', () => {
	it('middle click starts panning', () => {
		const { interaction } = setup();
		interaction.pointerDown(1, 100, 100, 'mouse', 1);

		expect(interaction.interactionType).toBe('panning');
	});

	it('space + left click starts panning', () => {
		const { interaction, setSpaceHeld } = setup();
		setSpaceHeld(true);
		interaction.pointerDown(1, 100, 100, 'mouse', 0);

		expect(interaction.interactionType).toBe('panning');
	});

	it('space + right click starts panning', () => {
		const { interaction, setSpaceHeld } = setup();
		setSpaceHeld(true);
		interaction.pointerDown(1, 100, 100, 'mouse', 2);

		expect(interaction.interactionType).toBe('panning');
	});

	it('window pointer move during panning calls onViewportChange', () => {
		const { interaction, callbacks } = setup();
		interaction.pointerDown(1, 100, 100, 'mouse', 1);

		interaction.windowPointerMove(1, 120, 110, 4);

		expect(callbacks.onViewportChange).toHaveBeenCalledOnce();
	});

	it('returns to idle when no buttons are pressed', () => {
		const { interaction } = setup();
		interaction.pointerDown(1, 100, 100, 'mouse', 1);

		interaction.windowPointerMove(1, 120, 110, 0);

		expect(interaction.interactionType).toBe('idle');
	});

	it('pointer up during panning returns to idle', () => {
		const { interaction } = setup();
		interaction.pointerDown(1, 100, 100, 'mouse', 1);

		interaction.pointerUp(1, 100, 100);

		expect(interaction.interactionType).toBe('idle');
	});

	it('middle click does not call onDrawStart', () => {
		const { interaction, callbacks } = setup();
		interaction.pointerDown(1, 100, 100, 'mouse', 1);

		expect(callbacks.onDrawStart).not.toHaveBeenCalled();
	});
});

// ── Pinching ───────────────────────────────────────────────────

describe('pinching', () => {
	it('two pointers enter pinching mode', () => {
		const { interaction } = setup();
		interaction.pointerDown(1, 50, 50, 'touch', 0);
		interaction.pointerDown(2, 200, 200, 'touch', 0);

		expect(interaction.interactionType).toBe('pinching');
	});

	it('cancels drawing when second touch pointer arrives', () => {
		const { interaction, callbacks } = setup();
		interaction.pointerDown(1, 50, 50, 'touch', 0);
		interaction.pointerMove(60, 60);

		interaction.pointerDown(2, 200, 200, 'touch', 0);

		expect(callbacks.onDrawEnd).toHaveBeenCalledOnce();
		expect(interaction.interactionType).toBe('pinching');
	});

	it('mouse drawing continues when touch pointer arrives', () => {
		const { interaction, callbacks } = setup();
		interaction.pointerDown(1, 50, 50, 'mouse', 0);
		expect(callbacks.onDrawStart).toHaveBeenCalledOnce();

		interaction.pointerDown(2, 200, 200, 'touch', 0);

		expect(callbacks.onDrawEnd).not.toHaveBeenCalled();
		expect(interaction.interactionType).toBe('drawing');
	});

	it('window pointer move during pinch calls onViewportChange', () => {
		const { interaction, callbacks } = setup();
		interaction.pointerDown(1, 50, 50, 'touch', 0);
		interaction.pointerDown(2, 200, 200, 'touch', 0);

		interaction.windowPointerMove(1, 30, 30, 1);

		expect(callbacks.onViewportChange).toHaveBeenCalled();
	});

	it('pointer up during pinching returns to idle', () => {
		const { interaction } = setup();
		interaction.pointerDown(1, 50, 50, 'touch', 0);
		interaction.pointerDown(2, 200, 200, 'touch', 0);

		interaction.pointerUp(1, 50, 50);

		expect(interaction.interactionType).toBe('idle');
	});

	it('defers pinch entry when distance below threshold', () => {
		const { interaction } = setup();
		interaction.pointerDown(1, 100, 100, 'touch', 0);
		interaction.pointerDown(2, 105, 105, 'touch', 0);

		expect(interaction.interactionType).not.toBe('pinching');
	});

	it('enters pinching after deferred pointers move apart', () => {
		const { interaction } = setup();
		interaction.pointerDown(1, 100, 100, 'touch', 0);
		interaction.pointerDown(2, 105, 105, 'touch', 0);

		interaction.windowPointerMove(2, 200, 200, 1);

		expect(interaction.interactionType).toBe('pinching');
	});

	it('pointer leave during pinching is ignored', () => {
		const { interaction } = setup();
		interaction.pointerDown(1, 50, 50, 'touch', 0);
		interaction.pointerDown(2, 200, 200, 'touch', 0);

		interaction.pointerLeave(50, 50);

		expect(interaction.interactionType).toBe('pinching');
	});

	it('blur during pinching clears pointers and returns to idle', () => {
		const { interaction } = setup();
		interaction.pointerDown(1, 50, 50, 'touch', 0);
		interaction.pointerDown(2, 200, 200, 'touch', 0);

		interaction.blur();

		expect(interaction.interactionType).toBe('idle');
	});
});

// ── Touch deferral (first-pixel bug fix) ───────────────────────

describe('touch deferral', () => {
	it('touch pointerDown does not call onDrawStart or onDraw', () => {
		const { interaction, callbacks } = setup();
		interaction.pointerDown(1, 50, 50, 'touch', 0);

		expect(callbacks.onDrawStart).not.toHaveBeenCalled();
		expect(callbacks.onDraw).not.toHaveBeenCalled();
		expect(interaction.interactionType).toBe('drawing');
	});

	it('touch pointerDown + second pointer does not call onDrawStart', () => {
		const { interaction, callbacks } = setup();
		interaction.pointerDown(1, 50, 50, 'touch', 0);
		interaction.pointerDown(2, 200, 200, 'touch', 0);

		expect(callbacks.onDrawStart).not.toHaveBeenCalled();
		expect(callbacks.onDraw).not.toHaveBeenCalled();
		expect(callbacks.onDrawEnd).not.toHaveBeenCalled();
	});

	it('touch pointerDown + pointerMove commits pending and draws', () => {
		const { interaction, callbacks } = setup();
		interaction.pointerDown(1, 0, 0, 'touch', 0);

		interaction.pointerMove(32, 0);

		expect(callbacks.onDrawStart).toHaveBeenCalledOnce();
		expect(callbacks.onDraw).toHaveBeenCalledTimes(2);
	});

	it('touch pointerDown + pointerUp draws as tap', () => {
		const { interaction, callbacks } = setup();
		interaction.pointerDown(1, 50, 50, 'touch', 0);

		interaction.pointerUp(1, 50, 50);

		expect(callbacks.onDrawStart).toHaveBeenCalledOnce();
		expect(callbacks.onDrawStart).toHaveBeenCalledWith(0, 'touch');
		expect(callbacks.onDraw).toHaveBeenCalledOnce();
		expect(callbacks.onDrawEnd).toHaveBeenCalledOnce();
	});

	it('mouse pointerDown calls onDraw immediately', () => {
		const { interaction, callbacks } = setup();
		interaction.pointerDown(1, 50, 50, 'mouse', 0);

		expect(callbacks.onDrawStart).toHaveBeenCalledOnce();
		expect(callbacks.onDraw).toHaveBeenCalledOnce();
	});
});

// ── pointerType plumbing ──────────────────────────────────────

describe('pointerType plumbing', () => {
	it('passes "mouse" as second arg to onDrawStart for mouse pointerDown', () => {
		const { interaction, callbacks } = setup();
		interaction.pointerDown(1, 50, 50, 'mouse', 0);

		expect(callbacks.onDrawStart).toHaveBeenCalledWith(0, 'mouse');
	});

	it('passes "pen" as second arg to onDrawStart for pen pointerDown', () => {
		const { interaction, callbacks } = setup();
		interaction.pointerDown(1, 50, 50, 'pen', 0);

		expect(callbacks.onDrawStart).toHaveBeenCalledWith(0, 'pen');
	});

	it('passes "touch" as second arg to onDrawStart on deferred commit (pointerMove after touch down)', () => {
		const { interaction, callbacks } = setup();
		interaction.pointerDown(1, 0, 0, 'touch', 0);

		interaction.pointerMove(32, 0);

		expect(callbacks.onDrawStart).toHaveBeenCalledWith(0, 'touch');
	});

	it('passes "touch" as second arg to onDrawStart on touch tap (pointerDown + pointerUp)', () => {
		const { interaction, callbacks } = setup();
		interaction.pointerDown(1, 50, 50, 'touch', 0);

		interaction.pointerUp(1, 50, 50);

		expect(callbacks.onDrawStart).toHaveBeenCalledWith(0, 'touch');
	});
});

// ── Edge cases ─────────────────────────────────────────────────

describe('edge cases', () => {
	it('blur during drawing calls onDrawEnd and returns to idle', () => {
		const { interaction, callbacks } = setup();
		interaction.pointerDown(1, 50, 50, 'mouse', 0);

		interaction.blur();

		expect(callbacks.onDrawEnd).toHaveBeenCalledOnce();
		expect(interaction.interactionType).toBe('idle');
	});

	it('blur during pending touch drawing does not call onDrawEnd', () => {
		const { interaction, callbacks } = setup();
		interaction.pointerDown(1, 50, 50, 'touch', 0);

		interaction.blur();

		expect(callbacks.onDrawEnd).not.toHaveBeenCalled();
		expect(interaction.interactionType).toBe('idle');
	});

	it('blur during panning returns to idle', () => {
		const { interaction } = setup();
		interaction.pointerDown(1, 100, 100, 'mouse', 1);

		interaction.blur();

		expect(interaction.interactionType).toBe('idle');
	});

	it('blur when idle has no effect', () => {
		const { interaction, callbacks } = setup();
		interaction.blur();

		expect(callbacks.onDrawEnd).not.toHaveBeenCalled();
		expect(interaction.interactionType).toBe('idle');
	});

	it('pointer leave when not drawing has no effect', () => {
		const { interaction, callbacks } = setup();
		interaction.pointerLeave(50, 50);

		expect(callbacks.onDrawEnd).not.toHaveBeenCalled();
		expect(interaction.interactionType).toBe('idle');
	});

	it('pointer up when idle does not call onDrawEnd', () => {
		const { interaction, callbacks } = setup();
		interaction.pointerUp(1, 50, 50);

		expect(callbacks.onDrawEnd).not.toHaveBeenCalled();
	});

	it('pointer leave during pending touch drawing discards without drawing', () => {
		const { interaction, callbacks } = setup();
		interaction.pointerDown(1, 50, 50, 'touch', 0);

		interaction.pointerLeave(60, 60);

		expect(callbacks.onDrawStart).not.toHaveBeenCalled();
		expect(callbacks.onDraw).not.toHaveBeenCalled();
		expect(callbacks.onDrawEnd).not.toHaveBeenCalled();
		expect(interaction.interactionType).toBe('idle');
	});
});

// ── Sampling session (touch long-press) ──────────────────────

describe('sampling — long-press entry', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it('fires onSampleStart at 400ms with touch pointerType', () => {
		const { interaction, callbacks } = setup();
		interaction.pointerDown(1, 0, 0, 'touch', 0);

		vi.advanceTimersByTime(400);

		expect(callbacks.onSampleStart).toHaveBeenCalledOnce();
		expect(callbacks.onSampleStart).toHaveBeenCalledWith({ x: 0, y: 0 }, 0, 'touch');
	});

	it('does not fire before 400ms', () => {
		const { interaction, callbacks } = setup();
		interaction.pointerDown(1, 50, 50, 'touch', 0);

		vi.advanceTimersByTime(300);

		expect(callbacks.onSampleStart).not.toHaveBeenCalled();
		expect(interaction.interactionType).toBe('drawing');
	});

	it('cancelled by pointer move (drag becomes normal draw)', () => {
		const { interaction, callbacks } = setup();
		interaction.pointerDown(1, 0, 0, 'touch', 0);
		interaction.pointerMove(32, 0);

		vi.advanceTimersByTime(400);

		expect(callbacks.onSampleStart).not.toHaveBeenCalled();
		expect(callbacks.onDrawStart).toHaveBeenCalledOnce();
	});

	it('cancelled by pointer up (tap commits as normal draw)', () => {
		const { interaction, callbacks } = setup();
		interaction.pointerDown(1, 50, 50, 'touch', 0);
		interaction.pointerUp(1, 50, 50);

		vi.advanceTimersByTime(400);

		expect(callbacks.onSampleStart).not.toHaveBeenCalled();
		expect(callbacks.onDrawStart).toHaveBeenCalledOnce();
		expect(callbacks.onDrawEnd).toHaveBeenCalledOnce();
	});

	it('cancelled by second touch (pinch)', () => {
		const { interaction, callbacks } = setup();
		interaction.pointerDown(1, 50, 50, 'touch', 0);
		interaction.pointerDown(2, 200, 200, 'touch', 0);

		vi.advanceTimersByTime(400);

		expect(callbacks.onSampleStart).not.toHaveBeenCalled();
	});

	it('cancelled by pointer leave', () => {
		const { interaction, callbacks } = setup();
		interaction.pointerDown(1, 50, 50, 'touch', 0);
		interaction.pointerLeave(50, 50);

		vi.advanceTimersByTime(400);

		expect(callbacks.onSampleStart).not.toHaveBeenCalled();
	});

	it('cancelled by blur', () => {
		const { interaction, callbacks } = setup();
		interaction.pointerDown(1, 50, 50, 'touch', 0);
		interaction.blur();

		vi.advanceTimersByTime(400);

		expect(callbacks.onSampleStart).not.toHaveBeenCalled();
	});

	it('does not fire for mouse pointer', () => {
		const { interaction, callbacks } = setup();
		interaction.pointerDown(1, 50, 50, 'mouse', 0);

		vi.advanceTimersByTime(400);

		expect(callbacks.onSampleStart).not.toHaveBeenCalled();
	});

	it('does not fire for pen pointer', () => {
		const { interaction, callbacks } = setup();
		interaction.pointerDown(1, 50, 50, 'pen', 0);

		vi.advanceTimersByTime(400);

		expect(callbacks.onSampleStart).not.toHaveBeenCalled();
	});

	it('enters sampling state when onSampleStart returns true', () => {
		const { interaction } = setup();
		interaction.pointerDown(1, 50, 50, 'touch', 0);

		vi.advanceTimersByTime(400);

		expect(interaction.interactionType).toBe('sampling');
	});

	it('stays in drawing when onSampleStart returns false', () => {
		const { interaction, callbacks } = setup({
			callbacks: { onSampleStart: vi.fn(() => false) }
		});
		interaction.pointerDown(1, 50, 50, 'touch', 0);

		vi.advanceTimersByTime(400);

		expect(callbacks.onSampleStart).toHaveBeenCalledOnce();
		expect(interaction.interactionType).toBe('drawing');
	});
});

describe('sampling — during session', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it('pointer move forwards canvas coords to onSampleUpdate', () => {
		const { interaction, callbacks } = setup();
		interaction.pointerDown(1, 0, 0, 'touch', 0);
		vi.advanceTimersByTime(400);

		interaction.pointerMove(32, 0);

		expect(callbacks.onSampleUpdate).toHaveBeenCalledOnce();
		expect(callbacks.onSampleUpdate).toHaveBeenCalledWith({ x: 1, y: 0 });
	});

	it('pointer move during sampling does not fire onDraw', () => {
		const { interaction, callbacks } = setup();
		interaction.pointerDown(1, 0, 0, 'touch', 0);
		vi.advanceTimersByTime(400);

		interaction.pointerMove(32, 0);

		expect(callbacks.onDraw).not.toHaveBeenCalled();
		expect(callbacks.onDrawStart).not.toHaveBeenCalled();
	});

	it('pointer up during sampling fires onSampleEnd and returns to idle', () => {
		const { interaction, callbacks } = setup();
		interaction.pointerDown(1, 50, 50, 'touch', 0);
		vi.advanceTimersByTime(400);

		interaction.pointerUp(1, 50, 50);

		expect(callbacks.onSampleEnd).toHaveBeenCalledOnce();
		expect(callbacks.onSampleCancel).not.toHaveBeenCalled();
		expect(callbacks.onDrawEnd).not.toHaveBeenCalled();
		expect(interaction.interactionType).toBe('idle');
	});
});

describe('sampling disruption', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it('pinch transition (second touch) cancels sampling without commit', () => {
		const { interaction, callbacks } = setup();
		interaction.pointerDown(1, 50, 50, 'touch', 0);
		vi.advanceTimersByTime(400);

		interaction.pointerDown(2, 200, 200, 'touch', 0);

		expect(callbacks.onSampleCancel).toHaveBeenCalledOnce();
		expect(callbacks.onSampleEnd).not.toHaveBeenCalled();
		expect(interaction.interactionType).toBe('pinching');
	});

	it('pointer leave cancels sampling without commit', () => {
		const { interaction, callbacks } = setup();
		interaction.pointerDown(1, 50, 50, 'touch', 0);
		vi.advanceTimersByTime(400);

		interaction.pointerLeave(50, 50);

		expect(callbacks.onSampleCancel).toHaveBeenCalledOnce();
		expect(callbacks.onSampleEnd).not.toHaveBeenCalled();
		expect(interaction.interactionType).toBe('idle');
	});

	it('blur cancels sampling without commit', () => {
		const { interaction, callbacks } = setup();
		interaction.pointerDown(1, 50, 50, 'touch', 0);
		vi.advanceTimersByTime(400);

		interaction.blur();

		expect(callbacks.onSampleCancel).toHaveBeenCalledOnce();
		expect(callbacks.onSampleEnd).not.toHaveBeenCalled();
		expect(interaction.interactionType).toBe('idle');
	});
});
