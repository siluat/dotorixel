export type WheelInputType = 'pinchZoom' | 'wheelZoom' | 'trackpadPan';

export function classifyWheelInput(
	deltaX: number,
	deltaY: number,
	deltaMode: number,
	ctrlKey: boolean
): WheelInputType {
	if (ctrlKey) return 'pinchZoom';

	if (deltaMode === 1) return 'wheelZoom';

	if (deltaX !== 0) return 'trackpadPan';

	if (!Number.isInteger(deltaY)) return 'trackpadPan';

	return 'wheelZoom';
}

// Trackpads fire events at ~60fps (~16ms apart).
// Mouse wheels fire once per detent, typically >100ms apart.
const RAPID_EVENT_THRESHOLD_MS = 80;
const RAPID_EVENT_MIN_COUNT = 2;
// After trackpad is detected, maintain classification briefly
// to cover short pauses within the same gesture (e.g., momentum phases).
const TRACKPAD_COOLDOWN_MS = 120;

export type WheelInputClassifier = (
	deltaX: number,
	deltaY: number,
	deltaMode: number,
	ctrlKey: boolean,
	now?: number
) => WheelInputType;

export function createWheelInputClassifier(): WheelInputClassifier {
	let lastEventTime = 0;
	let rapidEventCount = 0;
	let trackpadDetectedUntil = 0;

	return function classify(
		deltaX: number,
		deltaY: number,
		deltaMode: number,
		ctrlKey: boolean,
		now: number = Date.now()
	): WheelInputType {
		const baseResult = classifyWheelInput(deltaX, deltaY, deltaMode, ctrlKey);

		// Non-ambiguous results pass through directly.
		if (baseResult !== 'wheelZoom') {
			if (baseResult === 'trackpadPan') {
				// A clear trackpad signal refreshes the cooldown so that
				// subsequent ambiguous (integer deltaY) events within
				// the same gesture are also classified as trackpadPan.
				trackpadDetectedUntil = now + TRACKPAD_COOLDOWN_MS;
			}
			lastEventTime = now;
			rapidEventCount = 1;
			return baseResult;
		}

		// deltaMode=1 (Firefox line mode) is unambiguously mouse wheel —
		// skip time-based detection.
		if (deltaMode === 1) {
			lastEventTime = now;
			rapidEventCount = 1;
			return 'wheelZoom';
		}

		// Ambiguous case: integer deltaY, deltaX=0, not ctrlKey, pixel deltaMode.
		// Use event frequency to distinguish trackpad from mouse wheel.
		const elapsed = now - lastEventTime;
		lastEventTime = now;

		if (elapsed > 0 && elapsed < RAPID_EVENT_THRESHOLD_MS) {
			rapidEventCount++;
		} else {
			rapidEventCount = 1;
		}

		if (rapidEventCount >= RAPID_EVENT_MIN_COUNT) {
			trackpadDetectedUntil = now + TRACKPAD_COOLDOWN_MS;
		}

		if (now < trackpadDetectedUntil) {
			return 'trackpadPan';
		}

		return 'wheelZoom';
	};
}
