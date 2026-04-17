// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { createSamplingSession } from './sampling-session.svelte';
import { canvasFactory } from './wasm-backend';
import type { Color } from './color';

const RED: Color = { r: 255, g: 0, b: 0, a: 255 };
const BLUE: Color = { r: 0, g: 0, b: 255, a: 255 };

/** Builds a canvas where the left half is RED and the right half is BLUE. */
function splitCanvas(width: number, height: number): import('./canvas-model').PixelCanvas {
	const bytes = new Uint8Array(width * height * 4);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const i = (y * width + x) * 4;
			const color = x < width / 2 ? RED : BLUE;
			bytes[i] = color.r;
			bytes[i + 1] = color.g;
			bytes[i + 2] = color.b;
			bytes[i + 3] = color.a;
		}
	}
	return canvasFactory.fromPixels(width, height, bytes);
}

describe('samplingSession — initial state', () => {
	it('is inactive before start is called', () => {
		const canvas = canvasFactory.withColor(16, 16, RED);
		const session = createSamplingSession(() => canvas);

		expect(session.isActive).toBe(false);
	});
});

describe('samplingSession — start', () => {
	it('becomes active after start', () => {
		const canvas = canvasFactory.withColor(16, 16, RED);
		const session = createSamplingSession(() => canvas);

		session.start({ targetPixel: { x: 8, y: 8 }, commitTarget: 'foreground' });

		expect(session.isActive).toBe(true);
	});

	it('populates a 9×9 grid and the center color from the canvas at the target pixel', () => {
		const canvas = canvasFactory.withColor(16, 16, RED);
		const session = createSamplingSession(() => canvas);

		session.start({ targetPixel: { x: 8, y: 8 }, commitTarget: 'foreground' });

		expect(session.grid).toHaveLength(81);
		expect(session.centerColor).toEqual(RED);
	});
});

describe('samplingSession — update', () => {
	it('recomputes the center color when the target pixel moves to a differently colored region', () => {
		const canvas = splitCanvas(16, 16); // left half RED, right half BLUE
		const session = createSamplingSession(() => canvas);

		session.start({ targetPixel: { x: 2, y: 8 }, commitTarget: 'foreground' });
		expect(session.centerColor).toEqual(RED);

		session.update({ x: 12, y: 8 });

		expect(session.centerColor).toEqual(BLUE);
	});
});

describe('samplingSession — commit', () => {
	it('returns a colorPick effect for the foreground slot and an addRecentColor effect when the center is opaque', () => {
		const canvas = canvasFactory.withColor(16, 16, RED);
		const session = createSamplingSession(() => canvas);

		session.start({ targetPixel: { x: 8, y: 8 }, commitTarget: 'foreground' });
		const effects = session.commit();

		expect(effects).toEqual([
			{ type: 'colorPick', target: 'foreground', color: RED },
			{ type: 'addRecentColor', hex: '#ff0000' }
		]);
	});

	it('routes the colorPick to the background slot when commitTarget is background', () => {
		const canvas = canvasFactory.withColor(16, 16, RED);
		const session = createSamplingSession(() => canvas);

		session.start({ targetPixel: { x: 8, y: 8 }, commitTarget: 'background' });
		const effects = session.commit();

		expect(effects).toEqual([
			{ type: 'colorPick', target: 'background', color: RED },
			{ type: 'addRecentColor', hex: '#ff0000' }
		]);
	});

	it('returns no effects when the center pixel is fully transparent', () => {
		const TRANSPARENT: Color = { r: 0, g: 0, b: 0, a: 0 };
		const canvas = canvasFactory.withColor(16, 16, TRANSPARENT);
		const session = createSamplingSession(() => canvas);

		session.start({ targetPixel: { x: 8, y: 8 }, commitTarget: 'foreground' });
		const effects = session.commit();

		expect(effects).toEqual([]);
	});

	it('returns no effects when the target pixel is outside the canvas bounds', () => {
		const canvas = canvasFactory.withColor(16, 16, RED);
		const session = createSamplingSession(() => canvas);

		// targetPixel.x = -1 is outside the canvas; sampleGrid still clamps
		// centerColor to the edge pixel, but commit must refuse to pick.
		session.start({ targetPixel: { x: -1, y: 8 }, commitTarget: 'foreground' });
		const effects = session.commit();

		expect(effects).toEqual([]);
	});

	it('deactivates the session after a successful commit', () => {
		const canvas = canvasFactory.withColor(16, 16, RED);
		const session = createSamplingSession(() => canvas);

		session.start({ targetPixel: { x: 8, y: 8 }, commitTarget: 'foreground' });
		session.commit();

		expect(session.isActive).toBe(false);
		expect(session.grid).toEqual([]);
		expect(session.centerColor).toBeNull();
	});

	it('deactivates the session even when the commit produces no effects (transparent center)', () => {
		const TRANSPARENT: Color = { r: 0, g: 0, b: 0, a: 0 };
		const canvas = canvasFactory.withColor(16, 16, TRANSPARENT);
		const session = createSamplingSession(() => canvas);

		session.start({ targetPixel: { x: 8, y: 8 }, commitTarget: 'foreground' });
		session.commit();

		expect(session.isActive).toBe(false);
		expect(session.grid).toEqual([]);
		expect(session.centerColor).toBeNull();
	});

	it('deactivates the session even when the commit produces no effects (out of bounds)', () => {
		const canvas = canvasFactory.withColor(16, 16, RED);
		const session = createSamplingSession(() => canvas);

		session.start({ targetPixel: { x: -1, y: 8 }, commitTarget: 'foreground' });
		session.commit();

		expect(session.isActive).toBe(false);
		expect(session.grid).toEqual([]);
		expect(session.centerColor).toBeNull();
	});
});

describe('samplingSession — cancel', () => {
	it('deactivates the session without producing effects', () => {
		const canvas = canvasFactory.withColor(16, 16, RED);
		const session = createSamplingSession(() => canvas);

		session.start({ targetPixel: { x: 8, y: 8 }, commitTarget: 'foreground' });
		expect(session.isActive).toBe(true);

		session.cancel();

		expect(session.isActive).toBe(false);
	});
});
