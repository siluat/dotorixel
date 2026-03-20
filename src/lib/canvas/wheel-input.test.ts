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

	it('trusts base classification for first ambiguous event', () => {
		const classify = createWheelInputClassifier();
		expect(classify(0, -120, 0, false, 2000)).toBe('wheelZoom');
	});

	it('confirms mouse wheel after two slow events', () => {
		const classify = createWheelInputClassifier();
		expect(classify(0, -120, 0, false, 2000)).toBe('wheelZoom');
		// Second slow event (>30ms apart) confirms mouse wheel
		expect(classify(0, -120, 0, false, 2200)).toBe('wheelZoom');
		// Subsequent slow events maintain mouse wheel classification
		expect(classify(0, -120, 0, false, 2400)).toBe('wheelZoom');
	});

	it('detects rapid integer-deltaY events as trackpadPan', () => {
		const classify = createWheelInputClassifier();
		expect(classify(0, 4, 0, false, 2000)).toBe('wheelZoom');
		// Second event arrives rapidly — trackpad confirmed
		expect(classify(0, 4, 0, false, 2016)).toBe('trackpadPan');
		// Subsequent rapid events continue as trackpadPan
		expect(classify(0, 3, 0, false, 2032)).toBe('trackpadPan');
	});

	it('treats exact threshold boundary (30ms) as neither rapid nor slow', () => {
		const classify = createWheelInputClassifier();
		// Two events exactly 30ms apart — boundary is ambiguous, not slow
		classify(0, -120, 0, false, 2000);
		classify(0, -120, 0, false, 2030);
		// slow count should still be 1 (not 2), so no mouse wheel confirmation
		expect(classify(0, -120, 0, false, 2060)).toBe('trackpadPan');
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

	it('switches from mouse wheel to trackpad on clear signal', () => {
		const classify = createWheelInputClassifier();
		// Confirm mouse wheel
		classify(0, -120, 0, false, 2000);
		classify(0, -120, 0, false, 2200);
		// Clear trackpad signal (fractional deltaY) switches device
		classify(0, 3.5, 0, false, 2300);
		// After trackpad cooldown expires (2300+120=2420),
		// lastConfirmedDevice is 'trackpad' — ambiguous events default to trackpadPan
		expect(classify(0, 4, 0, false, 2450)).toBe('trackpadPan');
	});

	it('maintains wheelZoom during fast mouse wheel scrolling after confirmation', () => {
		const classify = createWheelInputClassifier();
		// Confirm mouse wheel
		classify(0, -120, 0, false, 2000);
		classify(0, -120, 0, false, 2200);
		expect(classify(0, -120, 0, false, 2400)).toBe('wheelZoom');
		// Rapid events (fast scrolling) cannot override confirmed mouse wheel
		expect(classify(0, -120, 0, false, 2420)).toBe('wheelZoom');
		expect(classify(0, -120, 0, false, 2440)).toBe('wheelZoom');
	});

	it('switches to trackpad via clear signal after mouse wheel confirmation', () => {
		const classify = createWheelInputClassifier();
		// Confirm mouse wheel
		classify(0, -120, 0, false, 2000);
		classify(0, -120, 0, false, 2200);
		expect(classify(0, -120, 0, false, 2400)).toBe('wheelZoom');
		// Clear trackpad signal (fractional deltaY) overrides mouse wheel
		expect(classify(0, 3.5, 0, false, 2500)).toBe('trackpadPan');
		// Subsequent ambiguous events within trackpad cooldown
		expect(classify(0, 4, 0, false, 2550)).toBe('trackpadPan');
	});

	it('remembers mouse wheel after long idle', () => {
		const classify = createWheelInputClassifier();
		// Confirm mouse wheel
		classify(0, -120, 0, false, 2000);
		classify(0, -120, 0, false, 2200);
		expect(classify(0, -120, 0, false, 2400)).toBe('wheelZoom');
		// Long idle (>1000ms) — cooldowns expire but lastConfirmedDevice persists
		expect(classify(0, -120, 0, false, 3500)).toBe('wheelZoom');
	});

	it('remembers mouse wheel from Firefox deltaMode=1 after long idle', () => {
		const classify = createWheelInputClassifier();
		// Firefox line mode is unambiguously mouse wheel
		classify(0, 3, 1, false, 2000);
		// Long idle — lastConfirmedDevice persists
		expect(classify(0, -120, 0, false, 3100)).toBe('wheelZoom');
	});

	it('maintains wheelZoom after idle even with rapid events', () => {
		const classify = createWheelInputClassifier();
		// Confirm mouse wheel
		classify(0, -120, 0, false, 2000);
		classify(0, -120, 0, false, 2200);
		expect(classify(0, -120, 0, false, 2400)).toBe('wheelZoom');
		// Long idle, then rapid events — confirmed mouse wheel persists
		expect(classify(0, 4, 0, false, 3500)).toBe('wheelZoom');
		expect(classify(0, 4, 0, false, 3516)).toBe('wheelZoom');
	});

	it('classifies fast mouse wheel scrolling as wheelZoom', () => {
		const classify = createWheelInputClassifier();
		expect(classify(0, -120, 0, false, 2000)).toBe('wheelZoom');
		// Second event at 50ms: confirmed (50ms > 30ms threshold = slow)
		expect(classify(0, -120, 0, false, 2050)).toBe('wheelZoom');
		// Subsequent fast events remain wheelZoom
		expect(classify(0, -120, 0, false, 2100)).toBe('wheelZoom');
		expect(classify(0, -120, 0, false, 2150)).toBe('wheelZoom');
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
