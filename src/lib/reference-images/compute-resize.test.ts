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
});
