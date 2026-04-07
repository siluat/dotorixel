import { describe, it, expect } from 'vitest';
import { extractViewportData, restoreViewportState, type ViewportData } from './view-types';

describe('ViewportData conversion', () => {
	const sampleData: ViewportData = {
		pixelSize: 24,
		zoom: 2.5,
		panX: 42.0,
		panY: -17.0,
		showGrid: false,
		gridColor: '#aabbcc'
	};

	it('round-trips all fields through extract → restore → extract', () => {
		const state = restoreViewportState(sampleData);
		const result = extractViewportData(state);

		expect(result).toEqual(sampleData);
	});

	it('restoreViewportState produces a valid ViewportState', () => {
		const state = restoreViewportState(sampleData);

		expect(state.viewport.pixel_size).toBe(24);
		expect(state.viewport.zoom).toBe(2.5);
		expect(state.viewport.pan_x).toBe(42.0);
		expect(state.viewport.pan_y).toBe(-17.0);
		expect(state.showGrid).toBe(false);
		expect(state.gridColor).toBe('#aabbcc');
	});

	it('extractViewportData reads all fields from ViewportState', () => {
		const state = restoreViewportState({
			pixelSize: 32,
			zoom: 1.0,
			panX: 0,
			panY: 0,
			showGrid: true,
			gridColor: '#cccccc'
		});
		const data = extractViewportData(state);

		expect(data.pixelSize).toBe(32);
		expect(data.zoom).toBe(1.0);
		expect(data.panX).toBe(0);
		expect(data.panY).toBe(0);
		expect(data.showGrid).toBe(true);
		expect(data.gridColor).toBe('#cccccc');
	});
});
