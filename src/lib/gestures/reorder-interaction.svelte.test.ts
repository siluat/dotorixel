import { describe, it, expect, vi } from 'vitest';
import { createReorderInteraction } from './reorder-interaction.svelte';

/**
 * Headless port of TimelinePanel's drag/keyboard reorder behavior suite.
 * Each test carries a `ports:` note naming the original component test it
 * replaces 1:1 (TimelinePanel.svelte.test.ts before the extraction); tests
 * marked `invariant:` are module-contract additions from issue 212.
 *
 * The two blocks mirror the module's two Timeline adapters:
 * - vertical machine, restricted allowed set, no tap threshold (Layer rows)
 * - horizontal machine, full range, 4px tap threshold (Frame ruler cells)
 */

interface FakePointerInit {
	pointerId?: number;
	clientX?: number;
	clientY?: number;
	button?: number;
}

/**
 * Minimal stand-in for a real PointerEvent. `currentTarget` deliberately lacks
 * setPointerCapture/releasePointerCapture so every test exercises the module's
 * capture try/catch tolerance (headless DOMs lack those methods too).
 */
function pointerEvent(init: FakePointerInit = {}): PointerEvent {
	return {
		pointerId: init.pointerId ?? 1,
		clientX: init.clientX ?? 0,
		clientY: init.clientY ?? 0,
		button: init.button ?? 0,
		currentTarget: {},
		preventDefault: vi.fn()
	} as unknown as PointerEvent;
}

function keyEvent(key: string): KeyboardEvent {
	return { key, preventDefault: vi.fn() } as unknown as KeyboardEvent;
}

describe('createReorderInteraction', () => {
	describe('vertical machine with a restricted allowed set (Timeline layer rows)', () => {
		// Three reorderable rows at visual indices 0..2, measured extent
		// unavailable (headless layout) so the 32px fallback drives the math —
		// the same geometry the original happy-dom suite ran under.
		function layerMachine(opts: {
			allowed?: () => readonly number[];
			onDrop?: (id: string, toVisualIndex: number) => void;
		} = {}) {
			return createReorderInteraction({
				axis: 'y',
				allowedIndices: opts.allowed ?? (() => [0, 1, 2]),
				measureExtent: () => undefined,
				onDrop: opts.onDrop ?? (() => {})
			});
		}

		// ports: "pointer-dragging row C downward by two row-heights and releasing
		// calls onReorderLayer with the dropped visual index"
		it('dragging down by two extents and releasing drops at the target index', () => {
			const onDrop = vi.fn();
			const machine = layerMachine({ onDrop });

			machine.pointerDown(pointerEvent({ clientY: 0 }), 'c', 0);
			machine.pointerMove(pointerEvent({ clientY: 64 }), 'c');
			machine.pointerUp(pointerEvent({ clientY: 64 }), 'c');

			expect(onDrop).toHaveBeenCalledWith('c', 2);
			expect(onDrop).toHaveBeenCalledTimes(1);
		});

		// ports: "pointer-dragging previews the moving row and displaced rows before release"
		it('previews the dragged item at its offset and displaces passed items, without committing', () => {
			const onDrop = vi.fn();
			const machine = layerMachine({ onDrop });

			machine.pointerDown(pointerEvent({ clientY: 0 }), 'c', 0);
			expect(machine.draggingId).toBe('c');
			expect(machine.translateFor('c', 0)).toBe(0);
			expect(machine.isDropTarget(0)).toBe(false);

			machine.pointerMove(pointerEvent({ clientY: 64 }), 'c');

			expect(machine.draggingId).toBe('c');
			expect(machine.isDropTarget(2)).toBe(true);
			expect(machine.isDropTarget(1)).toBe(false);
			expect(machine.translateFor('c', 0)).toBe(64);
			expect(machine.translateFor('b', 1)).toBe(-32);
			expect(machine.translateFor('a', 2)).toBe(-32);
			expect(onDrop).not.toHaveBeenCalled();
		});

		// ports: "pointer-dragging cannot target the fixed Reference row"
		it('snaps the target and the preview offset to the last allowed index', () => {
			const onDrop = vi.fn();
			// Four rows, the bottom one (index 3) outside the allowed set.
			const machine = layerMachine({ allowed: () => [0, 1, 2], onDrop });

			machine.pointerDown(pointerEvent({ clientY: 0 }), 'c', 0);
			machine.pointerMove(pointerEvent({ clientY: 96 }), 'c');
			expect(machine.translateFor('c', 0)).toBe(64);

			machine.pointerUp(pointerEvent({ clientY: 96 }), 'c');
			expect(onDrop).toHaveBeenCalledWith('c', 2);
		});

		// ports: "pointer release at a Y different from the last pointermove uses
		// the release Y for the target"
		it('uses the release coordinate for the drop target, not the last move', () => {
			const onDrop = vi.fn();
			const machine = layerMachine({ onDrop });

			machine.pointerDown(pointerEvent({ clientY: 0 }), 'c', 0);
			machine.pointerMove(pointerEvent({ clientY: 32 }), 'c');
			machine.pointerUp(pointerEvent({ clientY: 64 }), 'c');

			expect(onDrop).toHaveBeenCalledWith('c', 2);
		});

		// ports: "pointer cancel during a drag does not call onReorderLayer"
		it('cancel never commits and clears the drag', () => {
			const onDrop = vi.fn();
			const machine = layerMachine({ onDrop });

			machine.pointerDown(pointerEvent({ clientY: 0 }), 'c', 0);
			machine.pointerMove(pointerEvent({ clientY: 64 }), 'c');
			machine.pointerCancel(pointerEvent({ clientY: 64 }), 'c');

			expect(onDrop).not.toHaveBeenCalled();
			expect(machine.draggingId).toBe(null);
			expect(machine.translateFor('c', 0)).toBe(0);
		});

		// invariant: `canReorder` (allowed set length > 1) gates pointerDown — the
		// host also uses it to disable dedicated handles (issue 212).
		it('does not start a drag while fewer than two indices are allowed', () => {
			const onDrop = vi.fn();
			const machine = layerMachine({ allowed: () => [0], onDrop });
			expect(machine.canReorder).toBe(false);

			machine.pointerDown(pointerEvent({ clientY: 0 }), 'a', 0);
			expect(machine.draggingId).toBe(null);
			machine.pointerMove(pointerEvent({ clientY: 64 }), 'a');
			machine.pointerUp(pointerEvent({ clientY: 64 }), 'a');
			expect(onDrop).not.toHaveBeenCalled();

			expect(layerMachine({ allowed: () => [0, 1] }).canReorder).toBe(true);
		});

		// invariant: the extent measured at pointerdown (not the fallback) drives
		// slot rounding — e.g. the 40px mobile row height.
		it('uses the measured extent for target math and displacement', () => {
			const onDrop = vi.fn();
			const machine = createReorderInteraction({
				axis: 'y',
				allowedIndices: () => [0, 1, 2],
				measureExtent: () => 40,
				onDrop
			});

			machine.pointerDown(pointerEvent({ clientY: 0 }), 'c', 0);
			machine.pointerMove(pointerEvent({ clientY: 80 }), 'c');
			expect(machine.translateFor('b', 1)).toBe(-40);

			machine.pointerUp(pointerEvent({ clientY: 80 }), 'c');
			expect(onDrop).toHaveBeenCalledWith('c', 2);
		});

		// invariant: only the primary button starts a drag (current Timeline
		// behavior — right/middle presses fall through untouched).
		it('ignores non-primary buttons at pointerdown', () => {
			const onDrop = vi.fn();
			const machine = layerMachine({ onDrop });

			for (const button of [1, 2]) {
				machine.pointerDown(pointerEvent({ clientY: 0, button }), 'c', 0);
				expect(machine.draggingId).toBe(null);
				machine.pointerUp(pointerEvent({ clientY: 64, button }), 'c');
			}
			expect(onDrop).not.toHaveBeenCalled();
		});

		// ports: "a second pointer landing during an active drag does not steal or reset it"
		it('ignores a second pointer landing mid-drag; the first pointer still drives the drop', () => {
			const onDrop = vi.fn();
			const machine = layerMachine({ onDrop });

			machine.pointerDown(pointerEvent({ clientY: 0, pointerId: 1 }), 'c', 0);
			// Second finger lands on a different item — must not start a second drag.
			machine.pointerDown(pointerEvent({ clientY: 100, pointerId: 2 }), 'a', 2);
			expect(machine.draggingId).toBe('c');
			// Events from the secondary pointer are also ignored.
			machine.pointerMove(pointerEvent({ clientY: 200, pointerId: 2 }), 'c');
			machine.pointerUp(pointerEvent({ clientY: 200, pointerId: 2 }), 'c');
			expect(onDrop).not.toHaveBeenCalled();

			// The original pointer's release still drives the reorder.
			machine.pointerMove(pointerEvent({ clientY: 64, pointerId: 1 }), 'c');
			machine.pointerUp(pointerEvent({ clientY: 64, pointerId: 1 }), 'c');
			expect(onDrop).toHaveBeenCalledTimes(1);
			expect(onDrop).toHaveBeenCalledWith('c', 2);
		});

		// ports: "ArrowUp on a focused reorder handle moves the layer up one visual
		// position" and "ArrowDown … moves the layer down one visual position"
		it('axis arrows step the item one allowed index, consuming the key', () => {
			const onDrop = vi.fn();
			const machine = layerMachine({ onDrop });

			const up = keyEvent('ArrowUp');
			expect(machine.keydown(up, 'b', 1)).toBe(true);
			expect(onDrop).toHaveBeenCalledWith('b', 0);
			expect(up.preventDefault).toHaveBeenCalled();

			const down = keyEvent('ArrowDown');
			expect(machine.keydown(down, 'b', 1)).toBe(true);
			expect(onDrop).toHaveBeenCalledWith('b', 2);
			expect(onDrop).toHaveBeenCalledTimes(2);
		});

		// ports: "ArrowUp on the top-row reorder handle is a no-op", "ArrowDown on
		// the bottom-row reorder handle is a no-op", and "ArrowDown on the bottom
		// Pixel row above a Reference row is a no-op"
		it('arrow steps at the edges of the allowed set are consumed but drop nothing', () => {
			const onDrop = vi.fn();
			const machine = layerMachine({ onDrop });

			expect(machine.keydown(keyEvent('ArrowUp'), 'c', 0)).toBe(true);
			expect(machine.keydown(keyEvent('ArrowDown'), 'a', 2)).toBe(true);

			// Bottom Pixel row sitting above the fixed Reference row (outside the set).
			const aboveReference = layerMachine({ allowed: () => [0, 1], onDrop });
			expect(aboveReference.keydown(keyEvent('ArrowDown'), 'a', 1)).toBe(true);

			expect(onDrop).not.toHaveBeenCalled();
		});

		// invariant: arrow keys are ignored while a pointer drag is in flight (issue 212).
		it('ignores arrow keys mid-drag', () => {
			const onDrop = vi.fn();
			const machine = layerMachine({ onDrop });

			machine.pointerDown(pointerEvent({ clientY: 0 }), 'c', 0);
			expect(machine.keydown(keyEvent('ArrowDown'), 'c', 0)).toBe(false);
			expect(onDrop).not.toHaveBeenCalled();
		});

		// invariant: keys outside the axis pair belong to the host component
		// (Enter/Space propagation stays a component concern — issue 212).
		it('leaves non-axis keys unhandled', () => {
			const onDrop = vi.fn();
			const machine = layerMachine({ onDrop });

			for (const key of ['Enter', ' ', 'ArrowLeft', 'ArrowRight']) {
				const e = keyEvent(key);
				expect(machine.keydown(e, 'b', 1)).toBe(false);
				expect(e.preventDefault).not.toHaveBeenCalled();
			}
			expect(onDrop).not.toHaveBeenCalled();
		});

		// ports: "pointer release at the original Y does not call onReorderLayer"
		it('releasing within half an extent of the origin never commits', () => {
			const onDrop = vi.fn();
			const machine = layerMachine({ onDrop });

			machine.pointerDown(pointerEvent({ clientY: 0 }), 'b', 1);
			machine.pointerMove(pointerEvent({ clientY: 4 }), 'b');
			machine.pointerUp(pointerEvent({ clientY: 4 }), 'b');

			expect(onDrop).not.toHaveBeenCalled();
		});
	});

	describe('horizontal machine with tap discrimination (Timeline frame ruler cells)', () => {
		// Frame cells double as select-on-click targets: full [0, n-1] allowed
		// range, 4px tap threshold, 32px fallback column width — the original
		// ruler geometry under happy-dom.
		function frameMachine(opts: {
			count?: number;
			onDrop?: (id: string, toVisualIndex: number) => void;
		} = {}) {
			const count = opts.count ?? 3;
			return createReorderInteraction({
				axis: 'x',
				allowedIndices: () => Array.from({ length: count }, (_, i) => i),
				measureExtent: () => undefined,
				onDrop: opts.onDrop ?? (() => {}),
				tapThresholdPx: 4
			});
		}

		// ports: "pointer-dragging a ruler cell right by two columns reorders to
		// the dropped index"
		it('dragging right by two extents and releasing drops at the target index', () => {
			const onDrop = vi.fn();
			const machine = frameMachine({ onDrop });

			machine.pointerDown(pointerEvent({ clientX: 0 }), 'f1', 0);
			machine.pointerMove(pointerEvent({ clientX: 64 }), 'f1');
			machine.pointerUp(pointerEvent({ clientX: 64 }), 'f1');

			expect(onDrop).toHaveBeenCalledWith('f1', 2);
			expect(onDrop).toHaveBeenCalledTimes(1);
		});

		// ports: "does not also select the frame after a completed drag (trailing
		// click swallowed)"
		it('suppresses exactly one trailing pointer click after a completed drag', () => {
			const onDrop = vi.fn();
			const machine = frameMachine({ onDrop });

			machine.pointerDown(pointerEvent({ clientX: 0 }), 'f1', 0);
			machine.pointerMove(pointerEvent({ clientX: 64 }), 'f1');
			machine.pointerUp(pointerEvent({ clientX: 64 }), 'f1');
			expect(onDrop).toHaveBeenCalledWith('f1', 2);

			// The browser emits a pointer click (detail > 0) after this sequence;
			// the host swallows it when consume returns true — once only.
			expect(machine.consumeClickSuppression(1)).toBe(true);
			expect(machine.consumeClickSuppression(1)).toBe(false);
		});

		// ports: "keyboard-activates a frame even when a prior drag left the
		// suppress flag armed"
		it('never suppresses a keyboard click (detail 0), even with the flag armed', () => {
			const machine = frameMachine();

			// A real drag whose trailing pointer-click the browser suppressed
			// leaves the flag armed — no pointerdown follows to clear it.
			machine.pointerDown(pointerEvent({ clientX: 0 }), 'f1', 0);
			machine.pointerMove(pointerEvent({ clientX: 64 }), 'f1');
			machine.pointerUp(pointerEvent({ clientX: 64 }), 'f1');

			expect(machine.consumeClickSuppression(0)).toBe(false);
		});

		// ports: "still selects the frame on a tap (pointer down/up without movement)"
		it('treats a motionless press as a tap: no drop, no suppression, click preserved', () => {
			const onDrop = vi.fn();
			const machine = frameMachine({ onDrop });

			const down = pointerEvent({ clientX: 40 });
			machine.pointerDown(down, 'f2', 1);
			machine.pointerUp(pointerEvent({ clientX: 40 }), 'f2');

			expect(onDrop).not.toHaveBeenCalled();
			expect(machine.consumeClickSuppression(1)).toBe(false);
			// With a tap threshold the compatibility click is the select path —
			// pointerdown must not swallow it.
			expect(down.preventDefault).not.toHaveBeenCalled();
		});

		// ports: "treats a sub-threshold jitter as a select, not a reorder"
		it('treats sub-threshold jitter as a tap: no drop, click preserved', () => {
			const onDrop = vi.fn();
			const machine = frameMachine({ count: 2, onDrop });

			machine.pointerDown(pointerEvent({ clientX: 40 }), 'f2', 1);
			machine.pointerMove(pointerEvent({ clientX: 43 }), 'f2');
			machine.pointerUp(pointerEvent({ clientX: 43 }), 'f2');

			expect(onDrop).not.toHaveBeenCalled();
			expect(machine.consumeClickSuppression(1)).toBe(false);
		});

		// ports: "previews the moving cell and displaced cells before drop"
		it('previews the dragged cell at its offset and displaces passed cells, without committing', () => {
			const onDrop = vi.fn();
			const machine = frameMachine({ onDrop });

			machine.pointerDown(pointerEvent({ clientX: 0 }), 'f1', 0);
			expect(machine.draggingId).toBe('f1');
			expect(machine.isDropTarget(0)).toBe(false);

			machine.pointerMove(pointerEvent({ clientX: 64 }), 'f1');

			expect(machine.isDropTarget(2)).toBe(true);
			expect(machine.translateFor('f1', 0)).toBe(64);
			expect(machine.translateFor('f2', 1)).toBe(-32);
			expect(machine.translateFor('f3', 2)).toBe(-32);
			expect(onDrop).not.toHaveBeenCalled();
		});

		// ports: "pointer cancel during a ruler drag does not reorder"
		it('cancel during a ruler drag never commits', () => {
			const onDrop = vi.fn();
			const machine = frameMachine({ onDrop });

			machine.pointerDown(pointerEvent({ clientX: 0 }), 'f1', 0);
			machine.pointerMove(pointerEvent({ clientX: 64 }), 'f1');
			machine.pointerCancel(pointerEvent({ clientX: 64 }), 'f1');

			expect(onDrop).not.toHaveBeenCalled();
		});

		// ports: "does not start a ruler drag when only one frame exists"
		it('does not start a drag when only one frame exists', () => {
			const onDrop = vi.fn();
			const machine = frameMachine({ count: 1, onDrop });

			machine.pointerDown(pointerEvent({ clientX: 0 }), 'f1', 0);
			machine.pointerMove(pointerEvent({ clientX: 64 }), 'f1');
			machine.pointerUp(pointerEvent({ clientX: 64 }), 'f1');

			expect(machine.canReorder).toBe(false);
			expect(onDrop).not.toHaveBeenCalled();
		});

		// ports: "ignores a second pointer landing during an active ruler drag"
		it('ignores a second pointer landing mid-drag; the first still drives the drop', () => {
			const onDrop = vi.fn();
			const machine = frameMachine({ onDrop });

			machine.pointerDown(pointerEvent({ clientX: 0, pointerId: 1 }), 'f1', 0);
			machine.pointerDown(pointerEvent({ clientX: 200, pointerId: 2 }), 'f3', 2);
			machine.pointerMove(pointerEvent({ clientX: 200, pointerId: 2 }), 'f1');
			machine.pointerUp(pointerEvent({ clientX: 200, pointerId: 2 }), 'f1');
			expect(onDrop).not.toHaveBeenCalled();

			machine.pointerMove(pointerEvent({ clientX: 64, pointerId: 1 }), 'f1');
			machine.pointerUp(pointerEvent({ clientX: 64, pointerId: 1 }), 'f1');
			expect(onDrop).toHaveBeenCalledTimes(1);
			expect(onDrop).toHaveBeenCalledWith('f1', 2);
		});

		// invariant: the unified commit rule `(threshold === 0 || wasDrag) &&
		// target !== base` — with a threshold, a release far from the origin
		// without any threshold-crossing move stays a tap (issue 212).
		it('does not commit on release unless a move crossed the tap threshold', () => {
			const onDrop = vi.fn();
			const machine = frameMachine({ onDrop });

			machine.pointerDown(pointerEvent({ clientX: 0 }), 'f1', 0);
			machine.pointerUp(pointerEvent({ clientX: 64 }), 'f1');

			expect(onDrop).not.toHaveBeenCalled();
		});

		// invariant: a stale suppression flag (browser swallowed the post-drag
		// click) is unconditionally reset at the next pointerdown (issue 212).
		it('clears a stale suppression flag at the next pointerdown', () => {
			const onDrop = vi.fn();
			const machine = frameMachine({ onDrop });

			// Drag commits and arms the flag, but no trailing click ever consumes it.
			machine.pointerDown(pointerEvent({ clientX: 0 }), 'f1', 0);
			machine.pointerMove(pointerEvent({ clientX: 64 }), 'f1');
			machine.pointerUp(pointerEvent({ clientX: 64 }), 'f1');

			// The next genuine tap must select — the stale flag can't poison it.
			machine.pointerDown(pointerEvent({ clientX: 40 }), 'f2', 1);
			machine.pointerUp(pointerEvent({ clientX: 40 }), 'f2');
			expect(machine.consumeClickSuppression(1)).toBe(false);
		});
	});
});
