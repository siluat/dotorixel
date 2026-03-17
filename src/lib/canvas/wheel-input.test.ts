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

	it('classifies slow integer-deltaY events as wheelZoom', () => {
		const classify = createWheelInputClassifier();
		// Mouse wheel: events spaced >80ms apart
		expect(classify(0, -120, 0, false, 0)).toBe('wheelZoom');
		expect(classify(0, -120, 0, false, 200)).toBe('wheelZoom');
		expect(classify(0, -120, 0, false, 400)).toBe('wheelZoom');
	});

	it('detects rapid integer-deltaY events as trackpadPan', () => {
		const classify = createWheelInputClassifier();
		// Trackpad: events spaced ~16ms apart
		// First event is ambiguous (cold start) — classified as wheelZoom
		expect(classify(0, 4, 0, false, 0)).toBe('wheelZoom');
		// Second event arrives rapidly — trackpad detected
		expect(classify(0, 4, 0, false, 16)).toBe('trackpadPan');
		// Subsequent rapid events continue as trackpadPan
		expect(classify(0, 3, 0, false, 32)).toBe('trackpadPan');
	});

	it('maintains trackpadPan during cooldown after rapid events stop', () => {
		const classify = createWheelInputClassifier();
		// Build up rapid event detection
		classify(0, 4, 0, false, 0);
		classify(0, 4, 0, false, 16);
		// Cooldown is 120ms from t=16, so t=100 is still within cooldown
		expect(classify(0, 4, 0, false, 100)).toBe('trackpadPan');
	});

	it('reverts to wheelZoom after cooldown expires', () => {
		const classify = createWheelInputClassifier();
		classify(0, 4, 0, false, 0);
		classify(0, 4, 0, false, 16);
		// Cooldown expires: 16 + 120 = 136, so t=200 is past cooldown
		expect(classify(0, -120, 0, false, 200)).toBe('wheelZoom');
	});

	it('refreshes cooldown when clear trackpadPan events arrive', () => {
		const classify = createWheelInputClassifier();
		// Clear trackpadPan event (fractional deltaY) sets cooldown
		classify(0, 3.5, 0, false, 0);
		// Ambiguous event within cooldown → trackpadPan
		expect(classify(0, 4, 0, false, 50)).toBe('trackpadPan');
		// Still within cooldown (0 + 120 = 120)
		expect(classify(0, 4, 0, false, 100)).toBe('trackpadPan');
	});

	it('refreshes cooldown when clear trackpadPan with deltaX arrives', () => {
		const classify = createWheelInputClassifier();
		// Clear trackpadPan via deltaX
		classify(2, 4, 0, false, 0);
		// Subsequent ambiguous event within cooldown → trackpadPan
		expect(classify(0, 4, 0, false, 80)).toBe('trackpadPan');
	});

	it('each instance tracks state independently', () => {
		const classifier1 = createWheelInputClassifier();
		const classifier2 = createWheelInputClassifier();
		// Build up trackpad detection in classifier1
		classifier1(0, 4, 0, false, 0);
		classifier1(0, 4, 0, false, 16);
		// classifier2 has no history — same input is wheelZoom
		expect(classifier2(0, 4, 0, false, 16)).toBe('wheelZoom');
		expect(classifier1(0, 4, 0, false, 32)).toBe('trackpadPan');
	});
});
