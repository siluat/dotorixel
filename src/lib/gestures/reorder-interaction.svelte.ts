/**
 * Reorder Interaction (CONTEXT.md § Timeline): the pointer- and keyboard-driven
 * lifecycle for reordering items along one visual axis — begin → clamped
 * preview → drop commit.
 *
 * Unlike `long-press` (which receives plain pointer snapshots), this module
 * takes real `PointerEvent`s: it owns pointer capture and the preventDefault
 * policy, both of which require the event and its element.
 */

export interface ReorderInteractionOptions {
	axis: 'x' | 'y';
	/** Visual indices the drag may target; reevaluated on every event. */
	allowedIndices: () => readonly number[];
	/** Measures one item's extent (px) from the pointerdown element; undefined or ≤0 falls back. */
	measureExtent: (target: Element) => number | undefined;
	onDrop: (id: string, toVisualIndex: number) => void;
	/**
	 * Pointer travel (px along the axis) beyond which the gesture counts as a
	 * drag rather than a tap. Defaults to 0 — a dedicated handle where every
	 * press is a drag and no click needs discriminating.
	 */
	tapThresholdPx?: number;
	/** Extent used when measurement is unavailable (headless layout). Defaults to 32. */
	fallbackExtentPx?: number;
}

export interface ReorderInteraction {
	pointerDown(e: PointerEvent, id: string, visualIndex: number): void;
	pointerMove(e: PointerEvent, id: string): void;
	pointerUp(e: PointerEvent, id: string): void;
	pointerCancel(e: PointerEvent, id: string): void;
	/**
	 * Axis-aware arrow stepping (`y` → ArrowUp/Down, `x` → ArrowLeft/Right),
	 * committing through the same `onDrop`. Returns true when the key was
	 * consumed (preventDefault applied); other keys are left to the host.
	 */
	keydown(e: KeyboardEvent, id: string, visualIndex: number): boolean;
	/**
	 * Owns the trailing-click flag armed when a drag crosses the tap threshold.
	 * Call from the host's click handler with `event.detail`: true means the
	 * click trails a completed drag and must not select. Consuming clears the
	 * flag; keyboard clicks (`detail === 0`) are never suppressed.
	 */
	consumeClickSuppression(detail: number): boolean;
	/** Preview translation (px along the axis) for the item at `visualIndex`; 0 while idle. */
	translateFor(id: string, visualIndex: number): number;
	/** True for the slot the drag would drop into, when it differs from the origin. */
	isDropTarget(visualIndex: number): boolean;
	readonly draggingId: string | null;
	/** True while the allowed set has at least two indices; also gates pointerDown. */
	readonly canReorder: boolean;
}

const DEFAULT_EXTENT_PX = 32;

interface DragState {
	readonly id: string;
	readonly pointerId: number;
	readonly startCoord: number;
	readonly baseIndex: number;
	readonly extentPx: number;
	offsetPx: number;
	targetIndex: number;
}

export function createReorderInteraction(options: ReorderInteractionOptions): ReorderInteraction {
	const fallbackExtentPx = options.fallbackExtentPx ?? DEFAULT_EXTENT_PX;
	const tapThresholdPx = options.tapThresholdPx ?? 0;

	let drag = $state<DragState | null>(null);
	// Transient, non-reactive: armed when a drag crosses the tap threshold so
	// the trailing click selects nothing; consumed by the next click.
	let shouldSuppressNextClick = false;

	function coordOf(e: PointerEvent): number {
		return options.axis === 'y' ? e.clientY : e.clientX;
	}

	// Reevaluated on every event so the drag tracks mid-flight item changes
	// (e.g. undo removing a layer); empty sets fall back to the drag origin.
	function allowedBounds(active: DragState) {
		const allowed = options.allowedIndices();
		return {
			allowed,
			first: allowed[0] ?? active.baseIndex,
			last: allowed.at(-1) ?? active.baseIndex
		};
	}

	// Existing Timeline algorithm: bound the candidate into the allowed run,
	// then snap to the first allowed index ≥ it (else the last). Equivalent to
	// nearest-clamp while the allowed set is a contiguous run of indices.
	function targetIndexAt(coord: number, active: DragState): number {
		const offset = Math.round((coord - active.startCoord) / active.extentPx);
		const candidate = active.baseIndex + offset;
		const { allowed, first, last } = allowedBounds(active);
		const bounded = Math.max(first, Math.min(last, candidate));
		for (const index of allowed) {
			if (bounded <= index) return index;
		}
		return last;
	}

	function clampedOffsetAt(coord: number, active: DragState): number {
		const delta = coord - active.startCoord;
		const { first, last } = allowedBounds(active);
		const minOffset = (first - active.baseIndex) * active.extentPx;
		const maxOffset = (last - active.baseIndex) * active.extentPx;
		return Math.max(minOffset, Math.min(maxOffset, delta));
	}

	function activeDrag(e: PointerEvent, id: string): DragState | null {
		return drag !== null && drag.id === id && e.pointerId === drag.pointerId ? drag : null;
	}

	function releaseCapture(e: PointerEvent): void {
		try {
			(e.currentTarget as Element).releasePointerCapture(e.pointerId);
		} catch {
			// Headless DOMs and older browsers lack pointer capture — ignore.
		}
	}

	return {
		pointerDown(e, id, visualIndex) {
			// Only the initiating pointer drives a drag — a second pointer (e.g.
			// another finger on a multi-touch device) must not steal or reset it.
			if (drag !== null) return;
			if (e.button !== 0) return;
			// Fresh interaction — clear suppression left by any prior drag whose
			// trailing click the browser never delivered.
			shouldSuppressNextClick = false;
			if (options.allowedIndices().length < 2) return;
			const measured = options.measureExtent(e.currentTarget as Element);
			drag = {
				id,
				pointerId: e.pointerId,
				startCoord: coordOf(e),
				baseIndex: visualIndex,
				extentPx: measured !== undefined && measured > 0 ? measured : fallbackExtentPx,
				offsetPx: 0,
				targetIndex: visualIndex
			};
			try {
				(e.currentTarget as Element).setPointerCapture(e.pointerId);
			} catch {
				// Headless DOMs and older browsers lack pointer capture — ignore.
			}
			// A dedicated handle (threshold 0) wants no compatibility click, so it
			// suppresses it up front; a tap-discriminating target needs that click
			// as its select path.
			if (tapThresholdPx === 0) {
				e.preventDefault();
			}
		},
		pointerMove(e, id) {
			const active = activeDrag(e, id);
			if (active === null) return;
			if (tapThresholdPx > 0 && Math.abs(coordOf(e) - active.startCoord) > tapThresholdPx) {
				shouldSuppressNextClick = true;
			}
			active.offsetPx = clampedOffsetAt(coordOf(e), active);
			active.targetIndex = targetIndexAt(coordOf(e), active);
			e.preventDefault();
		},
		pointerUp(e, id) {
			const active = activeDrag(e, id);
			if (active === null) return;
			const target = targetIndexAt(coordOf(e), active);
			const base = active.baseIndex;
			// Unified commit rule: a dedicated handle (threshold 0) commits on any
			// displaced release; a tap-discriminating target additionally requires
			// that some move crossed the threshold (`wasDrag`).
			const wasDrag = shouldSuppressNextClick;
			drag = null;
			releaseCapture(e);
			if ((tapThresholdPx === 0 || wasDrag) && target !== base) {
				options.onDrop(id, target);
			}
		},
		pointerCancel(e, id) {
			if (activeDrag(e, id) === null) return;
			drag = null;
			releaseCapture(e);
		},
		consumeClickSuppression(detail) {
			// Keyboard activation emits clicks with detail 0 — never suppressed,
			// so a stale flag can't block Enter/Space selection.
			const shouldSuppress = shouldSuppressNextClick && detail > 0;
			shouldSuppressNextClick = false;
			return shouldSuppress;
		},
		keydown(e, id, visualIndex) {
			const stepBack = options.axis === 'y' ? 'ArrowUp' : 'ArrowLeft';
			const stepForward = options.axis === 'y' ? 'ArrowDown' : 'ArrowRight';
			if (e.key !== stepBack && e.key !== stepForward) return false;
			// A pointer drag owns the interaction; keyboard steps stay out of it.
			if (drag !== null) return false;
			e.preventDefault();
			const direction = e.key === stepBack ? -1 : 1;
			const allowed = options.allowedIndices();
			const current = allowed.indexOf(visualIndex);
			const target = current === -1 ? null : (allowed[current + direction] ?? null);
			if (target !== null) options.onDrop(id, target);
			return true;
		},
		translateFor(id, visualIndex) {
			if (drag === null) return 0;
			if (id === drag.id) return drag.offsetPx;
			if (drag.baseIndex < drag.targetIndex) {
				return visualIndex > drag.baseIndex && visualIndex <= drag.targetIndex
					? -drag.extentPx
					: 0;
			}
			if (drag.baseIndex > drag.targetIndex) {
				return visualIndex >= drag.targetIndex && visualIndex < drag.baseIndex
					? drag.extentPx
					: 0;
			}
			return 0;
		},
		isDropTarget(visualIndex) {
			return (
				drag !== null && drag.targetIndex !== drag.baseIndex && drag.targetIndex === visualIndex
			);
		},
		get draggingId() {
			return drag?.id ?? null;
		},
		get canReorder() {
			return options.allowedIndices().length > 1;
		}
	};
}
