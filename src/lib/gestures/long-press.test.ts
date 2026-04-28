import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLongPressDetector } from './long-press';

describe('long-press detector', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('fires onFire after the threshold elapses with the pointer held still', () => {
		const onFire = vi.fn();
		const detector = createLongPressDetector({
			threshold: 400,
			radius: 8,
			onFire,
			onMove: vi.fn(),
			onEnd: vi.fn()
		});

		detector.pointerDown({ pointerId: 1, x: 100, y: 100 });
		expect(onFire).not.toHaveBeenCalled();

		vi.advanceTimersByTime(400);

		expect(onFire).toHaveBeenCalledTimes(1);
		expect(onFire).toHaveBeenCalledWith({ pointerId: 1, x: 100, y: 100 });
	});

	it('fires with the most recent in-radius coords, not the initial down coords', () => {
		const onFire = vi.fn();
		const detector = createLongPressDetector({
			threshold: 400,
			radius: 8,
			onFire,
			onMove: vi.fn(),
			onEnd: vi.fn()
		});

		detector.pointerDown({ pointerId: 1, x: 100, y: 100 });
		vi.advanceTimersByTime(100);
		detector.pointerMove({ pointerId: 1, x: 105, y: 103 });
		vi.advanceTimersByTime(300);

		expect(onFire).toHaveBeenCalledWith({ pointerId: 1, x: 105, y: 103 });
	});

	it('still fires when pre-threshold movement stays within the radius (jitter tolerance)', () => {
		const onFire = vi.fn();
		const onCancel = vi.fn();
		const detector = createLongPressDetector({
			threshold: 400,
			radius: 8,
			onFire,
			onMove: vi.fn(),
			onEnd: vi.fn(),
			onCancel
		});

		detector.pointerDown({ pointerId: 1, x: 100, y: 100 });
		vi.advanceTimersByTime(100);
		// √(5² + 5²) = ~7.07 < 8
		detector.pointerMove({ pointerId: 1, x: 105, y: 105 });
		vi.advanceTimersByTime(100);
		detector.pointerMove({ pointerId: 1, x: 95, y: 95 });
		vi.advanceTimersByTime(300);

		expect(onCancel).not.toHaveBeenCalled();
		expect(onFire).toHaveBeenCalledTimes(1);
	});

	it('calls onCancel and does not fire when the pointer moves outside the radius before the threshold', () => {
		const onFire = vi.fn();
		const onCancel = vi.fn();
		const detector = createLongPressDetector({
			threshold: 400,
			radius: 8,
			onFire,
			onMove: vi.fn(),
			onEnd: vi.fn(),
			onCancel
		});

		detector.pointerDown({ pointerId: 1, x: 100, y: 100 });
		vi.advanceTimersByTime(100);
		// distance from origin = √(9² + 0²) = 9 > 8
		detector.pointerMove({ pointerId: 1, x: 109, y: 100 });
		vi.advanceTimersByTime(400);

		expect(onFire).not.toHaveBeenCalled();
		expect(onCancel).toHaveBeenCalledTimes(1);
	});

	it('dispose() clears the in-flight timer so a pending fire does not arrive after teardown', () => {
		const onFire = vi.fn();
		const onCancel = vi.fn();
		const detector = createLongPressDetector({
			threshold: 400,
			radius: 8,
			onFire,
			onMove: vi.fn(),
			onEnd: vi.fn(),
			onCancel
		});

		detector.pointerDown({ pointerId: 1, x: 100, y: 100 });
		vi.advanceTimersByTime(100);
		detector.dispose();
		vi.advanceTimersByTime(1000);

		expect(onFire).not.toHaveBeenCalled();
		expect(onCancel).not.toHaveBeenCalled();
	});

	it('ignores events from a different pointerId once a press is being tracked', () => {
		const onFire = vi.fn();
		const onMove = vi.fn();
		const onEnd = vi.fn();
		const onCancel = vi.fn();
		const detector = createLongPressDetector({
			threshold: 400,
			radius: 8,
			onFire,
			onMove,
			onEnd,
			onCancel
		});

		detector.pointerDown({ pointerId: 1, x: 100, y: 100 });
		// Second finger arrives — must not disrupt the tracked press.
		detector.pointerDown({ pointerId: 2, x: 500, y: 500 });
		detector.pointerMove({ pointerId: 2, x: 600, y: 600 });
		detector.pointerUp({ pointerId: 2, x: 600, y: 600 });

		vi.advanceTimersByTime(400);

		expect(onFire).toHaveBeenCalledTimes(1);
		expect(onFire).toHaveBeenCalledWith({ pointerId: 1, x: 100, y: 100 });

		// Live drag of the original pointer still works.
		detector.pointerMove({ pointerId: 2, x: 999, y: 999 }); // ignored
		detector.pointerMove({ pointerId: 1, x: 110, y: 100 });
		detector.pointerUp({ pointerId: 1, x: 110, y: 100 });

		expect(onMove).toHaveBeenCalledTimes(1);
		expect(onMove).toHaveBeenCalledWith({ pointerId: 1, x: 110, y: 100 });
		expect(onEnd).toHaveBeenCalledTimes(1);
		expect(onCancel).not.toHaveBeenCalled();
	});

	it('emits onEnd (commit) on pointercancel after firing — leave/cancel commits last value', () => {
		const onEnd = vi.fn();
		const onCancel = vi.fn();
		const detector = createLongPressDetector({
			threshold: 400,
			radius: 8,
			onFire: vi.fn(),
			onMove: vi.fn(),
			onEnd,
			onCancel
		});

		detector.pointerDown({ pointerId: 1, x: 100, y: 100 });
		vi.advanceTimersByTime(400);
		detector.pointerMove({ pointerId: 1, x: 150, y: 160 });
		detector.pointerCancel({ pointerId: 1, x: 150, y: 160 });

		expect(onEnd).toHaveBeenCalledTimes(1);
		expect(onEnd).toHaveBeenCalledWith({ pointerId: 1, x: 150, y: 160 });
		expect(onCancel).not.toHaveBeenCalled();
	});

	it('calls onCancel on pointercancel before firing', () => {
		const onEnd = vi.fn();
		const onCancel = vi.fn();
		const detector = createLongPressDetector({
			threshold: 400,
			radius: 8,
			onFire: vi.fn(),
			onMove: vi.fn(),
			onEnd,
			onCancel
		});

		detector.pointerDown({ pointerId: 1, x: 100, y: 100 });
		vi.advanceTimersByTime(100);
		detector.pointerCancel({ pointerId: 1, x: 100, y: 100 });
		vi.advanceTimersByTime(400);

		expect(onCancel).toHaveBeenCalledTimes(1);
		expect(onEnd).not.toHaveBeenCalled();
	});

	it('emits onEnd (commit) on pointerup after firing', () => {
		const onEnd = vi.fn();
		const onCancel = vi.fn();
		const detector = createLongPressDetector({
			threshold: 400,
			radius: 8,
			onFire: vi.fn(),
			onMove: vi.fn(),
			onEnd,
			onCancel
		});

		detector.pointerDown({ pointerId: 1, x: 100, y: 100 });
		vi.advanceTimersByTime(400);
		detector.pointerMove({ pointerId: 1, x: 150, y: 160 });
		detector.pointerUp({ pointerId: 1, x: 150, y: 160 });

		expect(onEnd).toHaveBeenCalledTimes(1);
		expect(onEnd).toHaveBeenCalledWith({ pointerId: 1, x: 150, y: 160 });
		expect(onCancel).not.toHaveBeenCalled();
	});

	it('emits onMove on pointer movement after the threshold has fired', () => {
		const onFire = vi.fn();
		const onMove = vi.fn();
		const detector = createLongPressDetector({
			threshold: 400,
			radius: 8,
			onFire,
			onMove,
			onEnd: vi.fn()
		});

		detector.pointerDown({ pointerId: 1, x: 100, y: 100 });
		vi.advanceTimersByTime(400);
		expect(onFire).toHaveBeenCalledTimes(1);

		// Movement past the radius is now part of live drag, not a cancel.
		detector.pointerMove({ pointerId: 1, x: 200, y: 200 });
		detector.pointerMove({ pointerId: 1, x: 220, y: 230 });

		expect(onMove).toHaveBeenCalledTimes(2);
		expect(onMove).toHaveBeenNthCalledWith(1, { pointerId: 1, x: 200, y: 200 });
		expect(onMove).toHaveBeenNthCalledWith(2, { pointerId: 1, x: 220, y: 230 });
	});

	it('calls onCancel and does not fire when the pointer releases before the threshold', () => {
		const onFire = vi.fn();
		const onCancel = vi.fn();
		const detector = createLongPressDetector({
			threshold: 400,
			radius: 8,
			onFire,
			onMove: vi.fn(),
			onEnd: vi.fn(),
			onCancel
		});

		detector.pointerDown({ pointerId: 1, x: 100, y: 100 });
		vi.advanceTimersByTime(200);
		detector.pointerUp({ pointerId: 1, x: 100, y: 100 });
		vi.advanceTimersByTime(400);

		expect(onFire).not.toHaveBeenCalled();
		expect(onCancel).toHaveBeenCalledTimes(1);
	});
});
