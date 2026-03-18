import { describe, it, expect } from 'vitest';
import { classifyWheelInput, createWheelInputClassifier } from './wheel-input.ts';

describe('classifyWheelInput', () => {
	it('returns pinchZoom when ctrlKey is true (regardless of other values)', () => {
		expect(classifyWheelInput(0, 10, 0, true)).toBe('pinchZoom');
		expect(classifyWheelInput(5, 10.5, 1, true)).toBe('pinchZoom');
	});

	it('returns wheelZoom when deltaMode is 1 (Firefox line mode)', () => {
		expect(classifyWheelInput(0, 3, 1, false)).toBe('wheelZoom');
	});

	it('returns trackpadPan when deltaX is non-zero', () => {
		expect(classifyWheelInput(5, 10, 0, false)).toBe('trackpadPan');
		expect(classifyWheelInput(-3, 0, 0, false)).toBe('trackpadPan');
	});

	it('returns trackpadPan when deltaY has fractional value', () => {
		expect(classifyWheelInput(0, 10.5, 0, false)).toBe('trackpadPan');
		expect(classifyWheelInput(0, -0.3, 0, false)).toBe('trackpadPan');
	});

	it('returns wheelZoom for integer deltaY with no other signals', () => {
		expect(classifyWheelInput(0, -120, 0, false)).toBe('wheelZoom');
		expect(classifyWheelInput(0, 100, 0, false)).toBe('wheelZoom');
	});
});

describe('createWheelInputClassifier', () => {
	it('passes through non-ambiguous results unchanged', () => {
		const classify = createWheelInputClassifier();
		expect(classify(0, 10, 0, true, 0)).toBe('pinchZoom');
		expect(classify(5, 10, 0, false, 100)).toBe('trackpadPan');
		expect(classify(0, 3, 1, false, 200)).toBe('wheelZoom');
		expect(classify(0, 10.5, 0, false, 300)).toBe('trackpadPan');
	});

	it('defaults to trackpadPan for first ambiguous event', () => {
		const classify = createWheelInputClassifier();
		// No prior events — safe default prevents unwanted zoom jump
		expect(classify(0, -120, 0, false, 2000)).toBe('trackpadPan');
	});

	it('confirms mouse wheel after two slow events', () => {
		const classify = createWheelInputClassifier();
		// First event: no device confirmed yet — safe default
		expect(classify(0, -120, 0, false, 2000)).toBe('trackpadPan');
		// Second slow event (>80ms apart) confirms mouse wheel
		expect(classify(0, -120, 0, false, 2200)).toBe('wheelZoom');
		// Subsequent slow events maintain mouse wheel classification
		expect(classify(0, -120, 0, false, 2400)).toBe('wheelZoom');
	});

	it('detects rapid integer-deltaY events as trackpadPan', () => {
		const classify = createWheelInputClassifier();
		// First ambiguous event: safe default
		expect(classify(0, 4, 0, false, 2000)).toBe('trackpadPan');
		// Second event arrives rapidly — trackpad confirmed
		expect(classify(0, 4, 0, false, 2016)).toBe('trackpadPan');
		// Subsequent rapid events continue as trackpadPan
		expect(classify(0, 3, 0, false, 2032)).toBe('trackpadPan');
	});

	it('treats exact threshold boundary (80ms) as neither rapid nor slow', () => {
		const classify = createWheelInputClassifier();
		// Two events exactly 80ms apart — boundary is ambiguous, not slow
		classify(0, -120, 0, false, 2000);
		classify(0, -120, 0, false, 2080);
		// slow count should still be 1 (not 2), so no mouse wheel confirmation
		expect(classify(0, -120, 0, false, 2160)).toBe('trackpadPan');
	});

	it('maintains trackpadPan during cooldown after rapid events stop', () => {
		const classify = createWheelInputClassifier();
		// Build up rapid event detection
		classify(0, 4, 0, false, 2000);
		classify(0, 4, 0, false, 2016);
		// Cooldown is 120ms from t=2016, so t=2100 is still within cooldown
		expect(classify(0, 4, 0, false, 2100)).toBe('trackpadPan');
	});

	it('falls back to safe default after trackpad cooldown expires', () => {
		const classify = createWheelInputClassifier();
		classify(0, 4, 0, false, 2000);
		classify(0, 4, 0, false, 2016);
		// Cooldown expires: 2016 + 120 = 2136
		// First event after cooldown: no device confirmed
		expect(classify(0, -120, 0, false, 2200)).toBe('trackpadPan');
		// Second slow event confirms mouse wheel
		expect(classify(0, -120, 0, false, 2400)).toBe('wheelZoom');
	});

	it('refreshes cooldown when clear trackpadPan events arrive', () => {
		const classify = createWheelInputClassifier();
		// Clear trackpadPan event (fractional deltaY) sets cooldown
		classify(0, 3.5, 0, false, 2000);
		// Ambiguous event within cooldown → trackpadPan
		expect(classify(0, 4, 0, false, 2050)).toBe('trackpadPan');
		// Still within cooldown (2000 + 120 = 2120)
		expect(classify(0, 4, 0, false, 2100)).toBe('trackpadPan');
	});

	it('refreshes cooldown when clear trackpadPan with deltaX arrives', () => {
		const classify = createWheelInputClassifier();
		// Clear trackpadPan via deltaX
		classify(2, 4, 0, false, 2000);
		// Subsequent ambiguous event within cooldown → trackpadPan
		expect(classify(0, 4, 0, false, 2080)).toBe('trackpadPan');
	});

	it('clears mouse wheel cooldown when clear trackpad signal arrives', () => {
		const classify = createWheelInputClassifier();
		// Confirm mouse wheel (cooldown until 2200+300=2500)
		classify(0, -120, 0, false, 2000);
		classify(0, -120, 0, false, 2200);
		// Clear trackpad signal (fractional deltaY) cancels mouse wheel cooldown
		classify(0, 3.5, 0, false, 2300);
		// After trackpad cooldown expires (2300+120=2420), mouse wheel cooldown
		// should NOT be active even though 2500 > 2450
		expect(classify(0, 4, 0, false, 2450)).toBe('trackpadPan');
	});

	it('overrides mouse wheel cooldown when rapid events indicate trackpad', () => {
		const classify = createWheelInputClassifier();
		// Confirm mouse wheel
		classify(0, -120, 0, false, 2000);
		classify(0, -120, 0, false, 2200);
		expect(classify(0, -120, 0, false, 2400)).toBe('wheelZoom');
		// Rapid event arrives — trackpad likely (mouse wheels can't fire this fast)
		expect(classify(0, 4, 0, false, 2430)).toBe('trackpadPan');
	});

	it('resets detection state after long idle', () => {
		const classify = createWheelInputClassifier();
		// Confirm mouse wheel
		classify(0, -120, 0, false, 2000);
		classify(0, -120, 0, false, 2200);
		expect(classify(0, -120, 0, false, 2400)).toBe('wheelZoom');
		// Long idle (>1000ms from last event) — state resets
		expect(classify(0, 4, 0, false, 3500)).toBe('trackpadPan');
		// Rapid event confirms trackpad
		expect(classify(0, 4, 0, false, 3516)).toBe('trackpadPan');
	});

	it('each instance tracks state independently', () => {
		const classifier1 = createWheelInputClassifier();
		const classifier2 = createWheelInputClassifier();
		// Build up trackpad detection in classifier1 (rapid events)
		classifier1(0, 4, 0, false, 2000);
		classifier1(0, 4, 0, false, 2016);
		// Build up mouse wheel detection in classifier2 (slow events)
		classifier2(0, -120, 0, false, 2000);
		classifier2(0, -120, 0, false, 2200);
		// Verify they return different results for ambiguous input
		expect(classifier1(0, 4, 0, false, 2032)).toBe('trackpadPan');
		expect(classifier2(0, -120, 0, false, 2400)).toBe('wheelZoom');
	});
});
