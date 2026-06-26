import { advancePlayhead } from './playback-advance';

/** One frame's playback-relevant data: its identity and display duration. */
export interface PlaybackFrame {
	readonly id: string;
	readonly durationMs: number;
}

/**
 * Schedules animation callbacks for the playback clock. Mirrors the
 * `requestAnimationFrame` / `cancelAnimationFrame` contract so production wraps
 * the browser's animation-frame clock while tests drive the clock by hand.
 *
 * The callback's `timestampMs` must be monotonic non-decreasing (the rAF
 * contract). The clock loop relies on this: it clamps only the upper bound of a
 * delta (a backgrounded-tab resume), never a backward jump.
 */
export interface FrameScheduler {
	request(callback: (timestampMs: number) => void): number;
	cancel(handle: number): void;
}

/** The default scheduler, wrapping the browser's animation-frame clock. */
export const rafFrameScheduler: FrameScheduler = {
	request: (callback) => requestAnimationFrame(callback),
	cancel: (handle) => cancelAnimationFrame(handle)
};

export interface PlaybackControllerDeps {
	/**
	 * The Document's frames in axis order, read live each tick. Never empty — a
	 * Document always holds at least one frame, so `start()` trusts `frames[0]`.
	 */
	readonly getFrames: () => readonly PlaybackFrame[];
	/**
	 * Commit any in-flight Floating Selection before playback previews the
	 * committed Document — mirrors the active-frame-switch precedent.
	 */
	readonly commitFloatingSelection: () => void;
	/**
	 * Request a re-composite of the display buffer. Called only when the displayed
	 * frame changes — on start, on each playhead advance, and on stop — never on a
	 * tick that leaves the playhead frame unchanged.
	 */
	readonly requestRender: () => void;
	readonly frameScheduler: FrameScheduler;
}

// A backgrounded tab hands rAF a multi-second delta on refocus; clamp it so
// playback never fast-forwards through a burst of frames when the tab returns.
const MAX_FRAME_DELTA_MS = 1000;

/**
 * The headless playback engine for one tab: it owns the transient playhead and a
 * clock, feeding the playhead composite into the display buffer the renderer
 * already reads. Playback never mutates the Document — no dirty mark, no history
 * entry, no moved Active Frame.
 *
 * `isPlaying`, `isLooping`, and `playheadFrameId` are transient reactive state,
 * never persisted; a tab always starts stopped. The animation-frame loop is a
 * thin wrapper over the pure {@link advancePlayhead} decision, which it feeds
 * real wall-clock deltas.
 */
export class PlaybackController {
	#deps: PlaybackControllerDeps;

	isPlaying = $state(false);
	isLooping = $state(false);
	/** The frame the display buffer should show, or `null` while stopped. */
	playheadFrameId = $state<string | null>(null);

	#accumulatedMs = 0;
	#lastTimestampMs: number | null = null;
	#scheduledHandle: number | null = null;

	constructor(deps: PlaybackControllerDeps) {
		this.#deps = deps;
	}

	/**
	 * Starts playback from the first frame. Commits any in-flight Floating
	 * Selection first so the preview shows the committed Document. No-op when
	 * already playing.
	 */
	start(): void {
		if (this.isPlaying) return;
		this.#deps.commitFloatingSelection();
		const frames = this.#deps.getFrames();
		this.isPlaying = true;
		this.playheadFrameId = frames[0].id;
		this.#accumulatedMs = 0;
		this.#lastTimestampMs = null;
		this.#deps.requestRender();
		this.#scheduleNextFrame();
	}

	/**
	 * Stops playback and discards the playhead, returning the display to the
	 * Active Frame. Serves Pause, a loop-off completion, and lifecycle teardown
	 * alike. No-op when already stopped.
	 */
	stop(): void {
		if (!this.isPlaying) return;
		this.#cancelScheduledFrame();
		this.isPlaying = false;
		this.playheadFrameId = null;
		this.#accumulatedMs = 0;
		this.#lastTimestampMs = null;
		this.#deps.requestRender();
	}

	toggleLoop(): void {
		this.isLooping = !this.isLooping;
	}

	#scheduleNextFrame(): void {
		this.#scheduledHandle = this.#deps.frameScheduler.request((timestampMs) =>
			this.#onFrame(timestampMs)
		);
	}

	#cancelScheduledFrame(): void {
		if (this.#scheduledHandle !== null) {
			this.#deps.frameScheduler.cancel(this.#scheduledHandle);
			this.#scheduledHandle = null;
		}
	}

	#onFrame(timestampMs: number): void {
		this.#scheduledHandle = null;
		if (!this.isPlaying) return;

		// The first frame after start only primes the clock baseline — no time
		// has elapsed against the playhead yet.
		if (this.#lastTimestampMs === null) {
			this.#lastTimestampMs = timestampMs;
			this.#scheduleNextFrame();
			return;
		}

		const delta = Math.min(timestampMs - this.#lastTimestampMs, MAX_FRAME_DELTA_MS);
		this.#lastTimestampMs = timestampMs;
		this.#accumulatedMs += delta;

		const frames = this.#deps.getFrames();
		const currentIndex = frames.findIndex((frame) => frame.id === this.playheadFrameId);
		if (currentIndex < 0) {
			// The playhead frame vanished from under us — stop defensively.
			this.stop();
			return;
		}

		const durations = frames.map((frame) => frame.durationMs);
		const result = advancePlayhead(currentIndex, this.#accumulatedMs, durations, this.isLooping);
		this.#accumulatedMs = result.carryMs;

		if (result.stopped) {
			// Stopping returns the display to the Active Frame, so rendering the
			// last playhead frame first is pointless — stop() supersedes it within
			// this same tick (Svelte batches the two $state writes into one flush).
			this.stop();
			return;
		}

		if (result.nextIndex !== currentIndex) {
			this.playheadFrameId = frames[result.nextIndex].id;
			this.#deps.requestRender();
		}

		this.#scheduleNextFrame();
	}
}
