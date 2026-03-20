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
const SLOW_EVENT_MIN_COUNT = 2;
// After a device is detected, maintain classification briefly
// to cover short pauses within the same gesture.
const TRACKPAD_COOLDOWN_MS = 120;
const MOUSE_WHEEL_COOLDOWN_MS = 300;
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
	let mouseWheelDetectedUntil = 0;
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

		// Non-ambiguous results pass through directly.
		if (baseResult !== 'wheelZoom') {
			if (baseResult === 'trackpadPan') {
				// A clear trackpad signal refreshes the cooldown so that
				// subsequent ambiguous (integer deltaY) events within
				// the same gesture are also classified as trackpadPan.
				trackpadDetectedUntil = now + TRACKPAD_COOLDOWN_MS;
				mouseWheelDetectedUntil = 0;
				lastConfirmedDevice = 'trackpad';
			}
			lastEventTime = now;
			rapidEventCount = 1;
			slowEventCount = 0;
			return baseResult;
		}

		// deltaMode=1 (Firefox line mode) is unambiguously mouse wheel —
		// skip time-based detection.
		if (deltaMode === 1) {
			lastEventTime = now;
			rapidEventCount = 1;
			slowEventCount = 0;
			lastConfirmedDevice = 'mouseWheel';
			return 'wheelZoom';
		}

		// Ambiguous case: integer deltaY, deltaX=0, not ctrlKey, pixel deltaMode.
		// Use event frequency to distinguish trackpad from mouse wheel.
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

		if (rapidEventCount >= RAPID_EVENT_MIN_COUNT) {
			trackpadDetectedUntil = now + TRACKPAD_COOLDOWN_MS;
			mouseWheelDetectedUntil = 0;
			lastConfirmedDevice = 'trackpad';
		}

		if (slowEventCount >= SLOW_EVENT_MIN_COUNT) {
			mouseWheelDetectedUntil = now + MOUSE_WHEEL_COOLDOWN_MS;
			lastConfirmedDevice = 'mouseWheel';
		}

		// Trackpad detection takes priority (more reliable signal).
		if (now < trackpadDetectedUntil) {
			return 'trackpadPan';
		}

		// Only trust mouse wheel detection when the current event isn't rapid.
		// A rapid event during mouse wheel cooldown likely signals a device
		// switch to trackpad — default to the safer trackpadPan.
		if (now < mouseWheelDetectedUntil && !isRapid) {
			return 'wheelZoom';
		}

		// Both cooldowns expired — use the last confirmed device to avoid
		// misclassifying the first event after an idle pause.
		// Without this, every >1s pause causes one spurious pan for mouse wheel users.
		if (lastConfirmedDevice === 'mouseWheel' && !isRapid) {
			return 'wheelZoom';
		}

		// Neither device ever confirmed — trackpadPan is the safer default.
		// An unwanted pan is far less disruptive than an unwanted discrete
		// zoom jump (e.g., 1x → 2x).
		return 'trackpadPan';
	};
}
