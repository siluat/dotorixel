import { describe, it, expect } from 'vitest';
import { computeResize } from './compute-resize';

describe('computeResize', () => {
	it('preserves a square aspect ratio under a uniform corner drag', () => {
		const result = computeResize({
			startWidth: 100,
			startHeight: 100,
			deltaX: 50,
			deltaY: 50,
			minSize: 80
		});

		expect(result).toEqual({ width: 150, height: 150 });
	});

	it('preserves a landscape aspect ratio when the dominant axis drives the size', () => {
		const result = computeResize({
			startWidth: 200,
			startHeight: 100,
			deltaX: 50,
			deltaY: 50,
			minSize: 80
		});

		expect(result).toEqual({ width: 300, height: 150 });
	});

	it('preserves a portrait aspect ratio when the dominant axis drives the size', () => {
		const result = computeResize({
			startWidth: 100,
			startHeight: 200,
			deltaX: 50,
			deltaY: 50,
			minSize: 80
		});

		expect(result).toEqual({ width: 150, height: 300 });
	});

	it('clamps the shrunk size to the minSize floor while preserving aspect ratio', () => {
		const result = computeResize({
			startWidth: 200,
			startHeight: 100,
			deltaX: -180,
			deltaY: -80,
			minSize: 80
		});

		expect(result).toEqual({ width: 160, height: 80 });
	});

	it('clamps to floor with aspect preserved when proposed dims go negative on a landscape image', () => {
		const result = computeResize({
			startWidth: 200,
			startHeight: 100,
			deltaX: -400,
			deltaY: -200,
			minSize: 80
		});

		expect(result).toEqual({ width: 160, height: 80 });
	});

	it('clamps to floor with aspect preserved when proposed dims go negative on a portrait image', () => {
		const result = computeResize({
			startWidth: 100,
			startHeight: 200,
			deltaX: -200,
			deltaY: -400,
			minSize: 80
		});

		expect(result).toEqual({ width: 80, height: 160 });
	});

	it('clamps to floor without producing NaN when both proposed dims collapse to zero', () => {
		const result = computeResize({
			startWidth: 200,
			startHeight: 100,
			deltaX: -200,
			deltaY: -100,
			minSize: 80
		});

		expect(Number.isFinite(result.width)).toBe(true);
		expect(Number.isFinite(result.height)).toBe(true);
		expect(result).toEqual({ width: 160, height: 80 });
	});
});
