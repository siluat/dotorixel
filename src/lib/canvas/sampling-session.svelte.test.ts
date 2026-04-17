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

	it('preserves the last valid opaque centerColor when the target pixel moves out of canvas', () => {
		const canvas = canvasFactory.withColor(16, 16, RED);
		const session = createSamplingSession(() => canvas);

		session.start({ targetPixel: { x: 8, y: 8 }, commitTarget: 'foreground' });
		expect(session.centerColor).toEqual(RED);

		// (-1, 8) is outside the canvas → grid center is null. The last
		// valid opaque color must stay on centerColor so a future live
		// preview does not flicker to "no color".
		session.update({ x: -1, y: 8 });

		expect(session.centerColor).toEqual(RED);
	});

	it('preserves the last valid opaque centerColor when the target pixel moves onto a transparent pixel', () => {
		const TRANSPARENT: Color = { r: 0, g: 0, b: 0, a: 0 };
		// Left column transparent, rest RED — so a single update can cross
		// from an opaque region into a transparent one.
		const width = 16;
		const height = 16;
		const bytes = new Uint8Array(width * height * 4);
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				const i = (y * width + x) * 4;
				const color = x === 0 ? TRANSPARENT : RED;
				bytes[i] = color.r;
				bytes[i + 1] = color.g;
				bytes[i + 2] = color.b;
				bytes[i + 3] = color.a;
			}
		}
		const canvas = canvasFactory.fromPixels(width, height, bytes);
		const session = createSamplingSession(() => canvas);

		session.start({ targetPixel: { x: 8, y: 8 }, commitTarget: 'foreground' });
		expect(session.centerColor).toEqual(RED);

		session.update({ x: 0, y: 8 });

		expect(session.centerColor).toEqual(RED);
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

		// targetPixel.x = -1 is outside the canvas, so the center cell is
		// null and commit must refuse to pick even though there is no
		// preserved centerColor either.
		session.start({ targetPixel: { x: -1, y: 8 }, commitTarget: 'foreground' });
		const effects = session.commit();

		expect(effects).toEqual([]);
	});

	it('returns no effects when a drag drifts onto a transparent pixel before release', () => {
		const TRANSPARENT: Color = { r: 0, g: 0, b: 0, a: 0 };
		// Left column transparent, rest RED — session starts on RED, then
		// drags onto the transparent column. The preserved centerColor stays
		// RED (for live preview), but commit must read the CURRENT center
		// and refuse because the user released over a transparent pixel.
		const width = 16;
		const height = 16;
		const bytes = new Uint8Array(width * height * 4);
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				const i = (y * width + x) * 4;
				const color = x === 0 ? TRANSPARENT : RED;
				bytes[i] = color.r;
				bytes[i + 1] = color.g;
				bytes[i + 2] = color.b;
				bytes[i + 3] = color.a;
			}
		}
		const canvas = canvasFactory.fromPixels(width, height, bytes);
		const session = createSamplingSession(() => canvas);

		session.start({ targetPixel: { x: 8, y: 8 }, commitTarget: 'foreground' });
		session.update({ x: 0, y: 8 });
		const effects = session.commit();

		expect(effects).toEqual([]);
	});

	it('returns no effects when a drag drifts out of canvas before release', () => {
		const canvas = canvasFactory.withColor(16, 16, RED);
		const session = createSamplingSession(() => canvas);

		session.start({ targetPixel: { x: 8, y: 8 }, commitTarget: 'foreground' });
		session.update({ x: -1, y: 8 });
		const effects = session.commit();

		expect(effects).toEqual([]);
	});

	it('commits the final opaque color when a drag crosses a transparent region back to another opaque region', () => {
		const TRANSPARENT: Color = { r: 0, g: 0, b: 0, a: 0 };
		// Column 0 transparent, 1..7 RED, 8..15 BLUE — drag RED → transparent → BLUE.
		// Proves the preserved `centerColor` (RED) from before the transparent
		// drift does not leak into the final commit; commit must read the
		// current grid center (BLUE).
		const width = 16;
		const height = 16;
		const bytes = new Uint8Array(width * height * 4);
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				const i = (y * width + x) * 4;
				const color = x === 0 ? TRANSPARENT : x < 8 ? RED : BLUE;
				bytes[i] = color.r;
				bytes[i + 1] = color.g;
				bytes[i + 2] = color.b;
				bytes[i + 3] = color.a;
			}
		}
		const canvas = canvasFactory.fromPixels(width, height, bytes);
		const session = createSamplingSession(() => canvas);

		session.start({ targetPixel: { x: 4, y: 8 }, commitTarget: 'foreground' });
		session.update({ x: 0, y: 8 });
		session.update({ x: 12, y: 8 });
		const effects = session.commit();

		expect(effects).toEqual([
			{ type: 'colorPick', target: 'foreground', color: BLUE },
			{ type: 'addRecentColor', hex: '#0000ff' }
		]);
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
