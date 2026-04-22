import { TOOL_SHORTCUTS, type ToolType } from './tool-registry';

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
	readonly isShortcutHintsVisible: boolean;

	/**
	 * Called by EditorController.handleDrawEnd to restore a temporary tool switch.
	 * Returns the tool to restore, or null if no restoration is needed.
	 * Consumes the internal state — subsequent calls return null until the next temporary switch.
	 */
	consumePendingToolRestore(): ToolType | null;
}

function isTextInputTarget(target: EventTarget | null): boolean {
	if (typeof HTMLElement === 'undefined' || !(target instanceof HTMLElement)) return false;
	return target.closest('input, select, textarea, [contenteditable]:not([contenteditable="false"])') !== null;
}

export function createKeyboardInput(host: KeyboardInputHost): KeyboardInput {
	let isSpaceHeld = $state(false);
	let isShiftHeld = $state(false);
	let isAltHeld = false;
	let shortcutHintsVisible = $state(false);
	let toolBeforeModifier: ToolType | null = null;

	return {
		handleKeyDown(event: KeyboardEvent): void {
			if (isTextInputTarget(event.target)) return;

			if (event.code === 'Slash') {
				event.preventDefault();
				if (event.repeat) return;
				if (host.isDrawing()) return;
				shortcutHintsVisible = true;
				return;
			}

			if (event.code === 'AltLeft' || event.code === 'AltRight') {
				if (event.repeat) return;
				isAltHeld = true;
				if (host.isDrawing()) return;
				if (host.getActiveTool() === 'eyedropper') return;
				toolBeforeModifier = host.getActiveTool();
				host.setActiveTool('eyedropper');
				return;
			}

			if (event.code === 'Space') {
				event.preventDefault();
				if (event.repeat) return;
				if (host.isDrawing()) return;
				isSpaceHeld = true;
				return;
			}

			if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
				if (event.repeat) return;
				isShiftHeld = true;
				if (host.isDrawing()) {
					host.notifyModifierChange();
				}
				return;
			}

			const isCtrlOrCmd = event.ctrlKey || event.metaKey;
			const isZKey = event.key.toLowerCase() === 'z';
			const isYKey = event.key.toLowerCase() === 'y';
			if (isCtrlOrCmd && isZKey && !event.shiftKey) {
				event.preventDefault();
				host.undo();
			} else if ((isCtrlOrCmd && isZKey && event.shiftKey) || (isCtrlOrCmd && isYKey)) {
				event.preventDefault();
				host.redo();
			}

			if (isCtrlOrCmd || event.altKey || event.shiftKey) return;

			if (event.code === 'KeyG') {
				if (event.repeat) return;
				host.toggleGrid();
				return;
			}

			if (event.code === 'KeyX') {
				if (event.repeat) return;
				host.swapColors();
				return;
			}

			if (host.isDrawing()) return;
			const tool = TOOL_SHORTCUTS[event.code];
			if (tool) {
				host.setActiveTool(tool);
			}
		},

		handleKeyUp(event: KeyboardEvent): void {
			if (event.code === 'Slash') {
				shortcutHintsVisible = false;
				return;
			}

			if (event.code === 'AltLeft' || event.code === 'AltRight') {
				isAltHeld = false;
				if (host.isDrawing()) return;
				if (toolBeforeModifier !== null) {
					host.setActiveTool(toolBeforeModifier);
					toolBeforeModifier = null;
				}
				return;
			}

			if (event.code === 'Space') {
				isSpaceHeld = false;
				return;
			}

			if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
				isShiftHeld = false;
				if (host.isDrawing()) {
					host.notifyModifierChange();
				}
				return;
			}
		},

		handleBlur(): void {
			isAltHeld = false;
			isSpaceHeld = false;
			isShiftHeld = false;
			shortcutHintsVisible = false;
			if (toolBeforeModifier !== null) {
				host.setActiveTool(toolBeforeModifier);
				toolBeforeModifier = null;
			}
		},

		get isSpaceHeld(): boolean {
			return isSpaceHeld;
		},
		get isShiftHeld(): boolean {
			return isShiftHeld;
		},
		get isShortcutHintsVisible(): boolean {
			return shortcutHintsVisible;
		},

		consumePendingToolRestore(): ToolType | null {
			if (toolBeforeModifier !== null && !isAltHeld) {
				const tool = toolBeforeModifier;
				toolBeforeModifier = null;
				return tool;
			}
			return null;
		}
	};
}
