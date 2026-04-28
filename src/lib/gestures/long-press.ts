/**
 * Long-press gesture detector. Pointer-event agnostic — the host element
 * forwards raw pointer snapshots and the detector emits gesture lifecycle
 * callbacks. Tracks a single pointer at a time; events from any other
 * `pointerId` are ignored until the tracked press ends.
 *
 * Lifecycle:
 *   pointerDown → (threshold ms within radius)              → onFire
 *               → (release before threshold)                → onCancel
 *               → (move outside radius before threshold)    → onCancel
 *   after onFire:
 *               → pointerMove                               → onMove
 *               → pointerUp / pointerCancel                 → onEnd (commit)
 *
 * Movement tolerance is measured as Euclidean distance from the initial
 * down point, in the pointer-coordinate space the host provides (typically
 * client/screen CSS px).
 */

export interface PointerSnapshot {
	readonly pointerId: number;
	readonly x: number;
	readonly y: number;
}

export interface LongPressOptions {
	/** Hold time required to fire, in milliseconds. Defaults to 400. */
	readonly threshold?: number;
	/** Pre-fire jitter tolerance radius, in pointer-coord units. Defaults to 8. */
	readonly radius?: number;
	onFire(p: PointerSnapshot): void;
	onMove(p: PointerSnapshot): void;
	/** Post-fire termination (clean release, or cancel — both commit per W3C "leave/cancel commits last value"). */
	onEnd(p: PointerSnapshot): void;
	/** Pre-fire termination (early release, out-of-radius, or cancel). Optional. */
	onCancel?(): void;
}

export interface LongPressDetector {
	pointerDown(p: PointerSnapshot): void;
	pointerMove(p: PointerSnapshot): void;
	pointerUp(p: PointerSnapshot): void;
	pointerCancel(p: PointerSnapshot): void;
	/** Clears any in-flight timer. Safe to call when idle. */
	dispose(): void;
}

const DEFAULT_THRESHOLD_MS = 400;
const DEFAULT_RADIUS_PX = 8;

export function createLongPressDetector(opts: LongPressOptions): LongPressDetector {
	const threshold = opts.threshold ?? DEFAULT_THRESHOLD_MS;
	const radius = opts.radius ?? DEFAULT_RADIUS_PX;
	const radiusSq = radius * radius;

	let timer: ReturnType<typeof setTimeout> | null = null;
	let trackedId: number | null = null;
	let origin: PointerSnapshot | null = null;
	let last: PointerSnapshot | null = null;
	let fired = false;

	function clearTimer(): void {
		if (timer !== null) {
			clearTimeout(timer);
			timer = null;
		}
	}

	function reset(): void {
		clearTimer();
		trackedId = null;
		origin = null;
		last = null;
		fired = false;
	}

	function distanceSqFromOrigin(p: PointerSnapshot): number {
		if (!origin) return 0;
		const dx = p.x - origin.x;
		const dy = p.y - origin.y;
		return dx * dx + dy * dy;
	}

	function endPress(p: PointerSnapshot): void {
		if (fired) {
			reset();
			opts.onEnd(p);
		} else {
			reset();
			opts.onCancel?.();
		}
	}

	return {
		pointerDown(p) {
			if (trackedId !== null) return;
			trackedId = p.pointerId;
			origin = p;
			last = p;
			fired = false;
			timer = setTimeout(() => {
				timer = null;
				fired = true;
				if (last) opts.onFire(last);
			}, threshold);
		},
		pointerMove(p) {
			if (p.pointerId !== trackedId) return;
			last = p;
			if (fired) {
				opts.onMove(p);
				return;
			}
			if (distanceSqFromOrigin(p) > radiusSq) {
				reset();
				opts.onCancel?.();
			}
		},
		pointerUp(p) {
			if (p.pointerId !== trackedId) return;
			endPress(p);
		},
		pointerCancel(p) {
			if (p.pointerId !== trackedId) return;
			endPress(p);
		},
		dispose() {
			reset();
		}
	};
}
