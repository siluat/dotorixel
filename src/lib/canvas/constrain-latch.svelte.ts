/**
 * Workspace-scoped sticky toggle that supplies the Shift-constrain held state
 * without the keyboard — touch users have no Shift key at all, and desktop
 * users get a clickable latch as a side benefit.
 *
 * The editor composition root OR-combines this latch with keyboard Shift at the
 * single seam tools read (`getShiftHeld`), so turning the latch on is — from
 * each tool's perspective — indistinguishable from holding the physical Shift
 * key: lines snap to 45°, rectangles/ellipses force a square/circle, a new
 * Marquee stays square, and a Floating Selection drag locks to its axis.
 *
 * Session-transient: it is never persisted to the workspace snapshot and resets
 * to off on reload, mirroring how keyboard Shift is never remembered.
 */
export class ConstrainLatch {
	#isActive = $state(false);

	/** Whether the latch is currently supplying the Shift-constrain held state. */
	get isActive(): boolean {
		return this.#isActive;
	}

	/** Flip the latch between on and off. */
	toggle(): void {
		this.#isActive = !this.#isActive;
	}
}
