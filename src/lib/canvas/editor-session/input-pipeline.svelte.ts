import type { CanvasPoint } from '../canvas-model';
import type { KeyboardInput } from '../keyboard-input.svelte';
import type { ConstrainLatch } from '../constrain-latch.svelte';
import type { PointerType } from '../canvas-interaction.svelte';
import type { Workspace } from './workspace.svelte';

/**
 * The session-level module in front of the canvas viewport that admits or
 * blocks draw/sample input (shortcut-hints admission), restores a temporary
 * tool switch when a stroke ends or cancels, and owns the keyboard and
 * Constrain-latch lifecycles.
 *
 * Closed scope: reads and plain commands do not pass through this module —
 * templates bind `workspace.shared` / `workspace.activeTab` directly. Adding
 * a delegation-only member here is a design-violation signal.
 */
export class InputPipeline {
	readonly #workspace: Workspace;
	readonly #keyboard: KeyboardInput;
	readonly #constrainLatch: ConstrainLatch;

	constructor(workspace: Workspace, keyboard: KeyboardInput, constrainLatch: ConstrainLatch) {
		this.#workspace = workspace;
		this.#keyboard = keyboard;
		this.#constrainLatch = constrainLatch;
	}

	handleDrawStart = (button: number, pointerType: PointerType): void => {
		if (this.#keyboard.isShortcutHintsVisible) return;
		this.#workspace.activeTab.drawStart(button, pointerType);
	};

	handleDraw = (current: CanvasPoint, previous: CanvasPoint | null): void => {
		if (this.#keyboard.isShortcutHintsVisible) return;
		this.#workspace.activeTab.draw(current, previous);
	};

	handleDrawEnd = (): void => {
		this.#workspace.activeTab.drawEnd();
		this.#restoreTemporaryTool();
	};

	handleDrawCancel = (): void => {
		this.#workspace.activeTab.drawCancel();
		this.#restoreTemporaryTool();
	};

	/**
	 * A held Alt temporarily switches to the eyedropper; the keyboard defers
	 * the switch-back while a stroke is active so releasing Alt mid-stroke
	 * doesn't change tools under the pointer. Stroke end/cancel is the point
	 * where that deferred restore lands.
	 */
	#restoreTemporaryTool(): void {
		const restored = this.#keyboard.consumePendingToolRestore();
		if (restored !== null) {
			this.#workspace.setActiveTool(restored);
		}
	}

	/**
	 * Returns whether a Canvas Sampling Session opened and consumed the press —
	 * `false` when the admission gate blocks it or the active tab declines.
	 */
	handleSampleStart = (coords: CanvasPoint, button: number, pointerType: PointerType): boolean => {
		// Same admission gate as draw: color slots sit outside History, so a
		// sample landing under the hints overlay would silently change one.
		if (this.#keyboard.isShortcutHintsVisible) return false;
		return this.#workspace.activeTab.sampleStart(coords, button, pointerType);
	};

	handleSampleUpdate = (coords: CanvasPoint): void => {
		this.#workspace.activeTab.sampleUpdate(coords);
	};

	handleSampleEnd = (): void => {
		this.#workspace.activeTab.sampleEnd();
	};

	handleSampleCancel = (): void => {
		this.#workspace.activeTab.sampleCancel();
	};

	/** Whether the Constrain latch currently supplies the Shift-held state. */
	get isConstrainActive(): boolean {
		return this.#constrainLatch.isActive;
	}

	toggleConstrain = (): void => {
		this.#constrainLatch.toggle();
		// Keyboard-Shift parity: tools live-read the latch only on draw samples,
		// so a stationary pointer would not reflect the toggle until the next move.
		if (this.#workspace.activeTab.isDrawing) {
			this.#workspace.activeTab.modifierChanged();
		}
	};

	handleKeyDown = (event: KeyboardEvent): void => {
		this.#keyboard.handleKeyDown(event);
	};

	handleKeyUp = (event: KeyboardEvent): void => {
		this.#keyboard.handleKeyUp(event);
	};

	handleBlur = (): void => {
		this.#keyboard.handleBlur();
	};

	/** Whether Space is currently held (consumed by canvas-interaction for panning). */
	get isSpaceHeld(): boolean {
		return this.#keyboard.isSpaceHeld;
	}

	/** Whether Shift is currently held. */
	get isShiftHeld(): boolean {
		return this.#keyboard.isShiftHeld;
	}

	/** Whether the shortcut hints overlay is visible — the admission gate's state. */
	get isShortcutHintsVisible(): boolean {
		return this.#keyboard.isShortcutHintsVisible;
	}
}
