import { describe, it, expect, beforeEach } from 'vitest';
import { setTracker, type AnalyticsEvent } from './tracker';
import { trackExport } from './events';

describe('trackExport', () => {
	let captured: AnalyticsEvent[];

	beforeEach(() => {
		captured = [];
		setTracker((event) => captured.push(event));
	});

	it('sends export event with format property', () => {
		trackExport(16, 16, 'png');
		expect(captured).toHaveLength(1);
		expect(captured[0].name).toBe('export');
		expect(captured[0].data).toMatchObject({ width: 16, height: 16, format: 'png' });
	});
});
