import { describe, it, expect } from 'vitest';
import { advancePlayhead } from './playback-advance';

describe('advancePlayhead', () => {
	it('advances one frame once the accumulated time reaches the current frame duration', () => {
		const result = advancePlayhead(0, 100, [100, 100, 100], false);

		expect(result.nextIndex).toBe(1);
		expect(result.carryMs).toBe(0);
		expect(result.stopped).toBe(false);
	});

	it('holds a longer-duration frame proportionally longer before advancing', () => {
		// Frame 0 lasts 300ms: 100ms and 299ms both hold; 300ms advances.
		expect(advancePlayhead(0, 100, [300, 100], false).nextIndex).toBe(0);
		expect(advancePlayhead(0, 299, [300, 100], false).nextIndex).toBe(0);
		expect(advancePlayhead(0, 300, [300, 100], false).nextIndex).toBe(1);
	});

	it('carries leftover time past the advanced frame so durations do not drift', () => {
		const result = advancePlayhead(0, 150, [100, 100, 100], false);

		expect(result.nextIndex).toBe(1);
		expect(result.carryMs).toBe(50);
	});

	it('crosses several frames in one call when the banked time covers them', () => {
		const result = advancePlayhead(0, 250, [100, 100, 100], false);

		expect(result.nextIndex).toBe(2);
		expect(result.carryMs).toBe(50);
		expect(result.stopped).toBe(false);
	});

	it('wraps from the last frame back to the first when looping', () => {
		const result = advancePlayhead(2, 100, [100, 100, 100], true);

		expect(result.nextIndex).toBe(0);
		expect(result.carryMs).toBe(0);
		expect(result.stopped).toBe(false);
	});

	it('stops when a non-looping sequence runs off its last frame', () => {
		const result = advancePlayhead(2, 100, [100, 100, 100], false);

		expect(result.stopped).toBe(true);
	});

	it('stops at the end even when the banked time would have crossed several frames', () => {
		const result = advancePlayhead(1, 250, [100, 100, 100], false);

		expect(result.nextIndex).toBe(2);
		expect(result.stopped).toBe(true);
	});

	it('never advances and never auto-stops a single-frame sequence, looping or not', () => {
		for (const isLooping of [true, false]) {
			const result = advancePlayhead(0, 500, [100], isLooping);

			expect(result.nextIndex).toBe(0);
			expect(result.carryMs).toBe(0);
			expect(result.stopped).toBe(false);
		}
	});
});
