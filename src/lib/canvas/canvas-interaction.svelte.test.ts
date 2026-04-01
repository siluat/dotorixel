import { describe, it, expect, vi } from 'vitest';
import { WasmViewport } from '$wasm/dotorixel_wasm';
import {
	createCanvasInteraction,
	type CanvasInteractionOptions,
	type CanvasInteractionCallbacks
} from './canvas-interaction.svelte';

function setup(overrides?: {
	options?: Partial<CanvasInteractionOptions>;
	callbacks?: Partial<CanvasInteractionCallbacks>;
}) {
	const callbacks: CanvasInteractionCallbacks = {
		onDrawStart: vi.fn(),
		onDraw: vi.fn(),
		onDrawEnd: vi.fn(),
		onViewportChange: vi.fn(),
		...overrides?.callbacks
	};
	let spaceHeld = false;
	const viewport = WasmViewport.for_canvas(16, 16); // pixel_size=32
	const options: CanvasInteractionOptions = {
		screenToCanvas: (x, y) => {
			const coords = viewport.screen_to_canvas(x, y);
			return { x: coords.x, y: coords.y };
		},
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
		expect(callbacks.onDrawStart).toHaveBeenCalledWith(2);
		expect(callbacks.onDraw).toHaveBeenCalledOnce();
		expect(interaction.interactionType).toBe('drawing');
	});

	it('left click passes button 0 to onDrawStart', () => {
		const { interaction, callbacks } = setup();
		interaction.pointerDown(1, 50, 50, 'mouse', 0);

		expect(callbacks.onDrawStart).toHaveBeenCalledWith(0);
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
		expect(callbacks.onDrawStart).toHaveBeenCalledWith(0);
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
