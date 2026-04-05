import type { ToolType } from './tool-types';

/**
 * Callbacks that the keyboard module needs from its owner.
 * Each callback maps to a read or command the keyboard handler can trigger.
 */
export interface KeyboardInputHost {
	/** Whether a draw stroke is in progress. */
	isDrawing(): boolean;
	/** The currently active tool. */
	getActiveTool(): ToolType;
	/** Set the active tool. */
	setActiveTool(tool: ToolType): void;
	/** Undo one step. */
	undo(): void;
	/** Redo one step. */
	redo(): void;
	/** Toggle grid visibility. */
	toggleGrid(): void;
	/** Swap foreground/background colors. */
	swapColors(): void;
	/** Notify that a modifier key changed mid-stroke. */
	notifyModifierChange(): void;
}

export interface KeyboardInput {
	/** Bind to svelte:window onkeydown. */
	readonly handleKeyDown: (event: KeyboardEvent) => void;
	/** Bind to svelte:window onkeyup. */
	readonly handleKeyUp: (event: KeyboardEvent) => void;
	/** Bind to svelte:window onblur. */
	readonly handleBlur: () => void;

	/** Whether Space is currently held (consumed by canvas-interaction for panning). */
	readonly isSpaceHeld: boolean;
	/** Whether Shift is currently held (consumed by ToolContext.isShiftHeld). */
	readonly isShiftHeld: boolean;
	/** Whether the shortcut hint overlay is visible. */
	readonly shortcutHintsVisible: boolean;

	/**
	 * Called by EditorState.handleDrawEnd to restore a temporary tool switch.
	 * Returns the tool to restore, or null if no restoration is needed.
	 * Consumes the internal state — subsequent calls return null until the next temporary switch.
	 */
	consumePendingToolRestore(): ToolType | null;
}

export function createKeyboardInput(_host: KeyboardInputHost): KeyboardInput {
	let isSpaceHeld = $state(false);
	let isShiftHeld = $state(false);
	let shortcutHintsVisible = $state(false);

	return {
		handleKeyDown(_event: KeyboardEvent): void {},
		handleKeyUp(_event: KeyboardEvent): void {},
		handleBlur(): void {},

		get isSpaceHeld(): boolean {
			return isSpaceHeld;
		},
		get isShiftHeld(): boolean {
			return isShiftHeld;
		},
		get shortcutHintsVisible(): boolean {
			return shortcutHintsVisible;
		},

		consumePendingToolRestore(): ToolType | null {
			return null;
		}
	};
}
