/**
 * The outcome of advancing the playhead by some banked wall-clock time.
 * `carryMs` is the leftover time that did not complete the next frame — banked
 * toward the following tick so variable durations never drift. `stopped` is set
 * only when a non-looping sequence runs off its last frame.
 */
export interface PlayheadAdvance {
	readonly nextIndex: number;
	readonly carryMs: number;
	readonly stopped: boolean;
}

/**
 * Pure advance decision for the playback clock — the testability seam under the
 * rAF loop. Given the current `playheadIndex`, the `accumulatedMs` of banked
 * wall-clock time, the per-frame `durations` in axis order, and whether playback
 * `isLooping`, it returns the frame to show next, the leftover time to carry, and
 * whether playback ran off the end.
 *
 * Each frame holds for its own `durations[index]` before the playhead advances;
 * a large banked time can cross several frames in one call. `durations` are the
 * Document's `duration_ms` values, which the WASM boundary clamps to `>= 1` ms.
 */
export function advancePlayhead(
	playheadIndex: number,
	accumulatedMs: number,
	durations: readonly number[],
	isLooping: boolean
): PlayheadAdvance {
	const frameCount = durations.length;
	// A single-frame sequence holds forever: it neither advances nor auto-stops.
	if (frameCount <= 1) {
		return { nextIndex: playheadIndex, carryMs: 0, stopped: false };
	}
	let index = playheadIndex;
	let remaining = accumulatedMs;
	while (remaining >= durations[index]) {
		remaining -= durations[index];
		if (index < frameCount - 1) {
			index += 1;
		} else if (isLooping) {
			index = 0;
		} else {
			// Loop off: ran off the last frame — stop, dropping leftover time.
			return { nextIndex: index, carryMs: 0, stopped: true };
		}
	}
	return { nextIndex: index, carryMs: remaining, stopped: false };
}
