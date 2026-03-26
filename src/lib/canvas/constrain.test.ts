import { describe, it, expect } from 'vitest';
import { constrainLine, constrainSquare } from './constrain';

describe('constrainLine', () => {
	const start = { x: 4, y: 4 };

	it('snaps to East (0°)', () => {
		expect(constrainLine(start, { x: 7, y: 5 })).toEqual({ x: 7, y: 4 });
	});

	it('snaps to West (180°)', () => {
		expect(constrainLine(start, { x: 1, y: 3 })).toEqual({ x: 1, y: 4 });
	});

	it('snaps to South (90°)', () => {
		expect(constrainLine(start, { x: 5, y: 7 })).toEqual({ x: 4, y: 7 });
	});

	it('snaps to North (270°)', () => {
		expect(constrainLine(start, { x: 3, y: 1 })).toEqual({ x: 4, y: 1 });
	});

	it('snaps to NE (45°)', () => {
		expect(constrainLine(start, { x: 7, y: 1 })).toEqual({ x: 7, y: 1 });
	});

	it('snaps to SE (135°)', () => {
		expect(constrainLine(start, { x: 7, y: 7 })).toEqual({ x: 7, y: 7 });
	});

	it('snaps to SW (225°)', () => {
		expect(constrainLine(start, { x: 1, y: 7 })).toEqual({ x: 1, y: 7 });
	});

	it('snaps to NW (315°)', () => {
		expect(constrainLine(start, { x: 1, y: 1 })).toEqual({ x: 1, y: 1 });
	});

	it('returns start when start === end', () => {
		expect(constrainLine(start, { x: 4, y: 4 })).toEqual({ x: 4, y: 4 });
	});

	it('forces diagonal distance to max(|dx|, |dy|)', () => {
		// dx=3, dy=2 → close to 45° → dist=3, sign(dy)=1
		expect(constrainLine(start, { x: 7, y: 6 })).toEqual({ x: 7, y: 7 });
	});
});

describe('constrainSquare', () => {
	const start = { x: 2, y: 2 };

	it('constrains to square in quadrant I (+x, +y)', () => {
		expect(constrainSquare(start, { x: 5, y: 4 })).toEqual({ x: 5, y: 5 });
	});

	it('constrains to square in quadrant II (-x, +y)', () => {
		expect(constrainSquare(start, { x: 0, y: 4 })).toEqual({ x: 0, y: 4 });
	});

	it('constrains to square in quadrant III (-x, -y)', () => {
		expect(constrainSquare(start, { x: 0, y: 1 })).toEqual({ x: 0, y: 0 });
	});

	it('constrains to square in quadrant IV (+x, -y)', () => {
		expect(constrainSquare(start, { x: 5, y: 1 })).toEqual({ x: 5, y: -1 });
	});

	it('returns start when start === end', () => {
		expect(constrainSquare(start, { x: 2, y: 2 })).toEqual({ x: 2, y: 2 });
	});
});
