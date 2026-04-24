// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { createSamplingSession } from './session.svelte';
import { createInMemorySamplingPort } from './adapters/in-memory';
import { LOUPE_HEIGHT, LOUPE_WIDTH, MOUSE_OFFSET, TOUCH_OFFSET } from './loupe-config';
import type { Color } from '../color';

const RED: Color = { r: 255, g: 0, b: 0, a: 255 };
const BLUE: Color = { r: 0, g: 0, b: 255, a: 255 };
const TRANSPARENT: Color = { r: 0, g: 0, b: 0, a: 0 };

/** Builds a uniform `width × height` grid of `color`. */
function uniformGrid(width: number, height: number, color: Color): (Color | null)[][] {
	return Array.from({ length: height }, () => Array.from({ length: width }, () => color));
}

/** Builds a grid where the left half is `left` and the right half is `right`. */
function splitGrid(width: number, height: number, left: Color, right: Color): (Color | null)[][] {
	return Array.from({ length: height }, () =>
		Array.from({ length: width }, (_, x) => (x < width / 2 ? left : right))
	);
}

describe('samplingSession — initial state', () => {
	it('is inactive before start is called', () => {
		const port = createInMemorySamplingPort(uniformGrid(16, 16, RED));
		const session = createSamplingSession({ getSamplingPort: () => port });

		expect(session.isActive).toBe(false);
	});

	it('exposes a null position before start', () => {
		const port = createInMemorySamplingPort(uniformGrid(16, 16, RED));
		const session = createSamplingSession({ getSamplingPort: () => port });

		expect(session.position).toBeNull();
	});

	it('exposes a null position even after updatePointer when inactive', () => {
		const port = createInMemorySamplingPort(uniformGrid(16, 16, RED));
		const session = createSamplingSession({ getSamplingPort: () => port });

		session.updatePointer({ screen: { x: 600, y: 400 }, viewport: { width: 1200, height: 800 } });

		expect(session.position).toBeNull();
	});
});

describe('samplingSession — start', () => {
	it('becomes active after start', () => {
		const port = createInMemorySamplingPort(uniformGrid(16, 16, RED));
		const session = createSamplingSession({ getSamplingPort: () => port });

		session.start({
			targetPixel: { x: 8, y: 8 },
			commitTarget: 'foreground',
			inputSource: 'mouse'
		});

		expect(session.isActive).toBe(true);
	});

	it('populates a 9×9 grid sampled around the target pixel', () => {
		const port = createInMemorySamplingPort(uniformGrid(16, 16, RED));
		const session = createSamplingSession({ getSamplingPort: () => port });

		session.start({
			targetPixel: { x: 8, y: 8 },
			commitTarget: 'foreground',
			inputSource: 'mouse'
		});

		expect(session.grid).toHaveLength(81);
		for (const cell of session.grid) {
			expect(cell).toEqual(RED);
		}
	});

	it('returns null position until pointer state is also seeded', () => {
		const port = createInMemorySamplingPort(uniformGrid(16, 16, RED));
		const session = createSamplingSession({ getSamplingPort: () => port });

		session.start({
			targetPixel: { x: 8, y: 8 },
			commitTarget: 'foreground',
			inputSource: 'mouse'
		});

		expect(session.position).toBeNull();
	});
});

describe('samplingSession — commit', () => {
	it('returns colorPick + addRecentColor effects for the foreground slot when the center is opaque', () => {
		const port = createInMemorySamplingPort(uniformGrid(16, 16, RED));
		const session = createSamplingSession({ getSamplingPort: () => port });

		session.start({
			targetPixel: { x: 8, y: 8 },
			commitTarget: 'foreground',
			inputSource: 'mouse'
		});
		const effects = session.commit();

		expect(effects).toEqual([
			{ type: 'colorPick', target: 'foreground', color: RED },
			{ type: 'addRecentColor', hex: '#ff0000' }
		]);
	});

	it('routes the colorPick to the background slot when commitTarget is background', () => {
		const port = createInMemorySamplingPort(uniformGrid(16, 16, RED));
		const session = createSamplingSession({ getSamplingPort: () => port });

		session.start({
			targetPixel: { x: 8, y: 8 },
			commitTarget: 'background',
			inputSource: 'touch'
		});
		const effects = session.commit();

		expect(effects).toEqual([
			{ type: 'colorPick', target: 'background', color: RED },
			{ type: 'addRecentColor', hex: '#ff0000' }
		]);
	});

	it('returns no effects when the center pixel is fully transparent', () => {
		const port = createInMemorySamplingPort(uniformGrid(16, 16, TRANSPARENT));
		const session = createSamplingSession({ getSamplingPort: () => port });

		session.start({
			targetPixel: { x: 8, y: 8 },
			commitTarget: 'foreground',
			inputSource: 'mouse'
		});
		const effects = session.commit();

		expect(effects).toEqual([]);
	});

	it('returns no effects when the target pixel is outside the canvas bounds', () => {
		const port = createInMemorySamplingPort(uniformGrid(16, 16, RED));
		const session = createSamplingSession({ getSamplingPort: () => port });

		session.start({
			targetPixel: { x: -1, y: 8 },
			commitTarget: 'foreground',
			inputSource: 'mouse'
		});
		const effects = session.commit();

		expect(effects).toEqual([]);
	});

	it('returns no effects when a drag releases on a transparent pixel even though earlier samples were opaque', () => {
		// Column 0 transparent, columns 1..15 RED.
		const grid: (Color | null)[][] = Array.from({ length: 16 }, () =>
			Array.from({ length: 16 }, (_, x) => (x === 0 ? TRANSPARENT : RED))
		);
		const port = createInMemorySamplingPort(grid);
		const session = createSamplingSession({ getSamplingPort: () => port });

		session.start({
			targetPixel: { x: 8, y: 8 },
			commitTarget: 'foreground',
			inputSource: 'mouse'
		});
		session.update({ x: 0, y: 8 });

		expect(session.commit()).toEqual([]);
	});

	it('commits the final opaque color when a drag crosses transparent back to a different opaque region', () => {
		// Column 0 transparent, 1..7 RED, 8..15 BLUE — drag RED → transparent → BLUE.
		const grid: (Color | null)[][] = Array.from({ length: 16 }, () =>
			Array.from({ length: 16 }, (_, x) => (x === 0 ? TRANSPARENT : x < 8 ? RED : BLUE))
		);
		const port = createInMemorySamplingPort(grid);
		const session = createSamplingSession({ getSamplingPort: () => port });

		session.start({
			targetPixel: { x: 4, y: 8 },
			commitTarget: 'foreground',
			inputSource: 'mouse'
		});
		session.update({ x: 0, y: 8 });
		session.update({ x: 12, y: 8 });

		expect(session.commit()).toEqual([
			{ type: 'colorPick', target: 'foreground', color: BLUE },
			{ type: 'addRecentColor', hex: '#0000ff' }
		]);
	});

	it('updates the grid when the target pixel moves to a differently colored region', () => {
		const port = createInMemorySamplingPort(splitGrid(16, 16, RED, BLUE));
		const session = createSamplingSession({ getSamplingPort: () => port });

		session.start({
			targetPixel: { x: 2, y: 8 },
			commitTarget: 'foreground',
			inputSource: 'mouse'
		});
		session.update({ x: 12, y: 8 });

		expect(session.commit()).toEqual([
			{ type: 'colorPick', target: 'foreground', color: BLUE },
			{ type: 'addRecentColor', hex: '#0000ff' }
		]);
	});

	it('deactivates the session after a successful commit', () => {
		const port = createInMemorySamplingPort(uniformGrid(16, 16, RED));
		const session = createSamplingSession({ getSamplingPort: () => port });

		session.start({
			targetPixel: { x: 8, y: 8 },
			commitTarget: 'foreground',
			inputSource: 'mouse'
		});
		session.commit();

		expect(session.isActive).toBe(false);
		expect(session.grid).toEqual([]);
	});

	it('deactivates the session even when commit produces no effects', () => {
		const port = createInMemorySamplingPort(uniformGrid(16, 16, TRANSPARENT));
		const session = createSamplingSession({ getSamplingPort: () => port });

		session.start({
			targetPixel: { x: 8, y: 8 },
			commitTarget: 'foreground',
			inputSource: 'mouse'
		});
		session.commit();

		expect(session.isActive).toBe(false);
	});

	it('returns no effects when commit is called without a prior start', () => {
		const port = createInMemorySamplingPort(uniformGrid(16, 16, RED));
		const session = createSamplingSession({ getSamplingPort: () => port });

		expect(session.commit()).toEqual([]);
	});
});

describe('samplingSession — cancel', () => {
	it('deactivates the session without producing effects', () => {
		const port = createInMemorySamplingPort(uniformGrid(16, 16, RED));
		const session = createSamplingSession({ getSamplingPort: () => port });

		session.start({
			targetPixel: { x: 8, y: 8 },
			commitTarget: 'foreground',
			inputSource: 'mouse'
		});
		session.cancel();

		expect(session.isActive).toBe(false);
	});

	it('returns no effects from a subsequent commit after cancel', () => {
		const port = createInMemorySamplingPort(uniformGrid(16, 16, RED));
		const session = createSamplingSession({ getSamplingPort: () => port });

		session.start({
			targetPixel: { x: 8, y: 8 },
			commitTarget: 'foreground',
			inputSource: 'mouse'
		});
		session.cancel();

		expect(session.commit()).toEqual([]);
	});

	it('clears position back to null after cancel', () => {
		const port = createInMemorySamplingPort(uniformGrid(16, 16, RED));
		const session = createSamplingSession({ getSamplingPort: () => port });

		session.updatePointer({ screen: { x: 600, y: 400 }, viewport: { width: 1200, height: 800 } });
		session.start({
			targetPixel: { x: 8, y: 8 },
			commitTarget: 'foreground',
			inputSource: 'mouse'
		});
		session.cancel();

		expect(session.position).toBeNull();
	});
});

describe('samplingSession — position', () => {
	const VIEWPORT = { width: 1200, height: 800 };

	it('places the loupe top-right of a centered mouse pointer at MOUSE_OFFSET', () => {
		const port = createInMemorySamplingPort(uniformGrid(16, 16, RED));
		const session = createSamplingSession({ getSamplingPort: () => port });

		session.updatePointer({ screen: { x: 600, y: 400 }, viewport: VIEWPORT });
		session.start({
			targetPixel: { x: 8, y: 8 },
			commitTarget: 'foreground',
			inputSource: 'mouse'
		});

		expect(session.position).toEqual({
			x: 600 + MOUSE_OFFSET,
			y: 400 - LOUPE_HEIGHT - MOUSE_OFFSET
		});
	});

	it('flips horizontally near the right edge for mouse input', () => {
		const port = createInMemorySamplingPort(uniformGrid(16, 16, RED));
		const session = createSamplingSession({ getSamplingPort: () => port });

		session.updatePointer({ screen: { x: 1180, y: 400 }, viewport: VIEWPORT });
		session.start({
			targetPixel: { x: 8, y: 8 },
			commitTarget: 'foreground',
			inputSource: 'mouse'
		});

		expect(session.position).toEqual({
			x: 1180 - LOUPE_WIDTH - MOUSE_OFFSET,
			y: 400 - LOUPE_HEIGHT - MOUSE_OFFSET
		});
	});

	it('flips vertically near the top edge for mouse input', () => {
		const port = createInMemorySamplingPort(uniformGrid(16, 16, RED));
		const session = createSamplingSession({ getSamplingPort: () => port });

		session.updatePointer({ screen: { x: 600, y: 100 }, viewport: VIEWPORT });
		session.start({
			targetPixel: { x: 8, y: 8 },
			commitTarget: 'foreground',
			inputSource: 'mouse'
		});

		expect(session.position).toEqual({
			x: 600 + MOUSE_OFFSET,
			y: 100 + MOUSE_OFFSET
		});
	});

	it('centers horizontally and offsets vertically by TOUCH_OFFSET for touch input', () => {
		const port = createInMemorySamplingPort(uniformGrid(16, 16, RED));
		const session = createSamplingSession({ getSamplingPort: () => port });

		session.updatePointer({ screen: { x: 600, y: 400 }, viewport: VIEWPORT });
		session.start({
			targetPixel: { x: 8, y: 8 },
			commitTarget: 'foreground',
			inputSource: 'touch'
		});

		expect(session.position).toEqual({
			x: 600 - LOUPE_WIDTH / 2,
			y: 400 - LOUPE_HEIGHT - TOUCH_OFFSET
		});
	});

	it('updates reactively when updatePointer is called during an active session', () => {
		const port = createInMemorySamplingPort(uniformGrid(16, 16, RED));
		const session = createSamplingSession({ getSamplingPort: () => port });

		session.updatePointer({ screen: { x: 600, y: 400 }, viewport: VIEWPORT });
		session.start({
			targetPixel: { x: 8, y: 8 },
			commitTarget: 'foreground',
			inputSource: 'mouse'
		});
		const initial = session.position;

		session.updatePointer({ screen: { x: 700, y: 500 }, viewport: VIEWPORT });

		expect(session.position).not.toEqual(initial);
		expect(session.position).toEqual({
			x: 700 + MOUSE_OFFSET,
			y: 500 - LOUPE_HEIGHT - MOUSE_OFFSET
		});
	});

	it('returns null position after commit', () => {
		const port = createInMemorySamplingPort(uniformGrid(16, 16, RED));
		const session = createSamplingSession({ getSamplingPort: () => port });

		session.updatePointer({ screen: { x: 600, y: 400 }, viewport: VIEWPORT });
		session.start({
			targetPixel: { x: 8, y: 8 },
			commitTarget: 'foreground',
			inputSource: 'mouse'
		});
		session.commit();

		expect(session.position).toBeNull();
	});
});
