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
		interaction.pointerDown(50, 50, 0);

		expect(callbacks.onDrawStart).toHaveBeenCalledOnce();
		expect(callbacks.onDraw).toHaveBeenCalledOnce();
		expect(interaction.interactionType).toBe('drawing');
	});

	it('pointer move continues drawing with previous coords', () => {
		const { interaction, callbacks } = setup();
		interaction.pointerDown(0, 0, 0);

		interaction.pointerMove(32, 0);

		expect(callbacks.onDraw).toHaveBeenCalledTimes(2);
		expect(callbacks.onDraw).toHaveBeenLastCalledWith({ x: 1, y: 0 }, { x: 0, y: 0 });
	});

	it('skips duplicate coordinates', () => {
		const { interaction, callbacks } = setup();
		interaction.pointerDown(0, 0, 0);

		interaction.pointerMove(0, 0);

		expect(callbacks.onDraw).toHaveBeenCalledTimes(1);
	});

	it('pointer up ends drawing', () => {
		const { interaction, callbacks } = setup();
		interaction.pointerDown(50, 50, 0);

		interaction.pointerUp();

		expect(callbacks.onDrawEnd).toHaveBeenCalledOnce();
		expect(interaction.interactionType).toBe('idle');
	});

	it('pointer leave draws final pixel and ends drawing', () => {
		const { interaction, callbacks } = setup();
		interaction.pointerDown(0, 0, 0);

		interaction.pointerLeave(32, 0);

		expect(callbacks.onDraw).toHaveBeenCalledTimes(2);
		expect(callbacks.onDrawEnd).toHaveBeenCalledOnce();
		expect(interaction.interactionType).toBe('idle');
	});

	it('right click does not start drawing', () => {
		const { interaction, callbacks } = setup();
		interaction.pointerDown(50, 50, 2);

		expect(callbacks.onDrawStart).not.toHaveBeenCalled();
		expect(interaction.interactionType).toBe('idle');
	});

	it('ignores pointer down when not idle', () => {
		const { interaction, callbacks } = setup();
		interaction.pointerDown(50, 50, 0);

		interaction.pointerDown(100, 100, 0);

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
		interaction.pointerDown(100, 100, 1);

		expect(interaction.interactionType).toBe('panning');
	});

	it('space + left click starts panning', () => {
		const { interaction, setSpaceHeld } = setup();
		setSpaceHeld(true);
		interaction.pointerDown(100, 100, 0);

		expect(interaction.interactionType).toBe('panning');
	});

	it('window pointer move during panning calls onViewportChange', () => {
		const { interaction, callbacks } = setup();
		interaction.pointerDown(100, 100, 1);

		interaction.windowPointerMove(120, 110, 4);

		expect(callbacks.onViewportChange).toHaveBeenCalledOnce();
	});

	it('returns to idle when no buttons are pressed', () => {
		const { interaction } = setup();
		interaction.pointerDown(100, 100, 1);

		interaction.windowPointerMove(120, 110, 0);

		expect(interaction.interactionType).toBe('idle');
	});

	it('pointer up during panning returns to idle', () => {
		const { interaction } = setup();
		interaction.pointerDown(100, 100, 1);

		interaction.pointerUp();

		expect(interaction.interactionType).toBe('idle');
	});

	it('middle click does not call onDrawStart', () => {
		const { interaction, callbacks } = setup();
		interaction.pointerDown(100, 100, 1);

		expect(callbacks.onDrawStart).not.toHaveBeenCalled();
	});
});

// ── Edge cases ─────────────────────────────────────────────────

describe('edge cases', () => {
	it('blur during drawing calls onDrawEnd and returns to idle', () => {
		const { interaction, callbacks } = setup();
		interaction.pointerDown(50, 50, 0);

		interaction.blur();

		expect(callbacks.onDrawEnd).toHaveBeenCalledOnce();
		expect(interaction.interactionType).toBe('idle');
	});

	it('blur during panning returns to idle', () => {
		const { interaction } = setup();
		interaction.pointerDown(100, 100, 1);

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
		interaction.pointerUp();

		expect(callbacks.onDrawEnd).not.toHaveBeenCalled();
	});
});
