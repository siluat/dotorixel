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

// Trackpads fire events at display refresh rate (~8-16ms apart).
// Mouse wheels fire once per detent, typically 40ms+ apart.
// The threshold sits between these ranges.
const RAPID_EVENT_THRESHOLD_MS = 30;
const RAPID_EVENT_MIN_COUNT = 2;
const SLOW_EVENT_MIN_COUNT = 2;
// After trackpad is detected, maintain classification briefly
// to cover short pauses within the same gesture.
const TRACKPAD_COOLDOWN_MS = 120;
// Reset all detection state after a long idle period,
// so the classifier starts fresh when the user returns.
const IDLE_TIMEOUT_MS = 1000;

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
	let slowEventCount = 0;
	let trackpadDetectedUntil = 0;
	// Persists across idle resets so the classifier remembers
	// which device was last confirmed during the session.
	let lastConfirmedDevice: 'trackpad' | 'mouseWheel' | null = null;

	return function classify(
		deltaX: number,
		deltaY: number,
		deltaMode: number,
		ctrlKey: boolean,
		now: number = Date.now()
	): WheelInputType {
		const baseResult = classifyWheelInput(deltaX, deltaY, deltaMode, ctrlKey);

		if (baseResult !== 'wheelZoom') {
			if (baseResult === 'trackpadPan') {
				// Refreshes the cooldown so that subsequent ambiguous
				// (integer deltaY) events within the same gesture
				// are also classified as trackpadPan.
				trackpadDetectedUntil = now + TRACKPAD_COOLDOWN_MS;
				lastConfirmedDevice = 'trackpad';
			}
			lastEventTime = now;
			rapidEventCount = 1;
			slowEventCount = 0;
			return baseResult;
		}

		if (deltaMode === 1) {
			lastEventTime = now;
			rapidEventCount = 1;
			slowEventCount = 0;
			lastConfirmedDevice = 'mouseWheel';
			return 'wheelZoom';
		}

		// First ambiguous event — no timing history yet. Prefer the same safe
		// default as the post-cooldown fall-through below: an unwanted pan is
		// far less disruptive than an unwanted discrete zoom jump. The next
		// slow event (within IDLE_TIMEOUT_MS) will confirm mouse wheel and
		// correct classification for the rest of the session.
		if (lastEventTime === 0) {
			lastEventTime = now;
			rapidEventCount = 1;
			slowEventCount = 1;
			return 'trackpadPan';
		}

		const elapsed = now - lastEventTime;
		lastEventTime = now;

		const isRapid = elapsed > 0 && elapsed < RAPID_EVENT_THRESHOLD_MS;

		if (elapsed >= IDLE_TIMEOUT_MS) {
			rapidEventCount = 1;
			slowEventCount = 1;
		} else if (isRapid) {
			rapidEventCount++;
			slowEventCount = 0;
		} else if (elapsed > RAPID_EVENT_THRESHOLD_MS) {
			slowEventCount++;
			rapidEventCount = 1;
		} else {
			rapidEventCount = 1;
			slowEventCount = 1;
		}

		// Detect trackpad from rapid events — but don't override a confirmed
		// mouse wheel. A confirmed mouse wheel requires a clear non-ambiguous
		// trackpad signal (fractional deltaY or non-zero deltaX) to switch.
		if (rapidEventCount >= RAPID_EVENT_MIN_COUNT && lastConfirmedDevice !== 'mouseWheel') {
			trackpadDetectedUntil = now + TRACKPAD_COOLDOWN_MS;
			lastConfirmedDevice = 'trackpad';
		}

		if (slowEventCount >= SLOW_EVENT_MIN_COUNT) {
			lastConfirmedDevice = 'mouseWheel';
		}

		if (now < trackpadDetectedUntil) {
			return 'trackpadPan';
		}

		if (lastConfirmedDevice === 'mouseWheel') {
			return 'wheelZoom';
		}

		// Trackpad confirmed or no device ever confirmed — trackpadPan is the safer default.
		// An unwanted pan is far less disruptive than an unwanted discrete
		// zoom jump (e.g., 1x → 2x).
		return 'trackpadPan';
	};
}
