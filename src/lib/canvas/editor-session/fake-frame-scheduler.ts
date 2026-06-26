import type { FrameScheduler } from './playback-controller.svelte';

export interface FakeFrameScheduler {
	/** Inject this in place of the browser's rAF to make the playback clock deterministic. */
	readonly scheduler: FrameScheduler;
	/** Fire the currently-scheduled frame at absolute timestamp `timestampMs` (mirrors the rAF contract). */
	fireAt(timestampMs: number): void;
	/** Whether a frame is currently scheduled — i.e., the clock is still running. */
	readonly hasScheduled: boolean;
}

/**
 * A hand-driven stand-in for `requestAnimationFrame`: it records the pending
 * callback so a test can fire frames at chosen timestamps, making the playback
 * clock deterministic. Only one frame is ever pending at a time, matching how the
 * controller reschedules a single frame per tick.
 */
export function createFakeFrameScheduler(): FakeFrameScheduler {
	let scheduled: ((timestampMs: number) => void) | null = null;
	let nextHandle = 1;
	return {
		scheduler: {
			request(callback: (timestampMs: number) => void): number {
				// The controller keeps exactly one frame pending; throwing on a
				// second schedule surfaces a double-schedule regression instead of
				// silently dropping the earlier callback.
				if (scheduled) {
					throw new Error('Animation frame already scheduled');
				}
				scheduled = callback;
				return nextHandle++;
			},
			cancel(): void {
				scheduled = null;
			}
		},
		fireAt(timestampMs: number): void {
			const callback = scheduled;
			scheduled = null;
			if (!callback) throw new Error('No animation frame scheduled');
			callback(timestampMs);
		},
		get hasScheduled(): boolean {
			return scheduled !== null;
		}
	};
}
