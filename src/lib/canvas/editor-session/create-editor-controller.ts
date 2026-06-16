import type { Color } from '../color';
import type { WorkspaceSnapshot } from '../workspace-snapshot';
import { createKeyboardInput, type KeyboardInput } from '../keyboard-input.svelte';
import { ConstrainLatch } from '../constrain-latch.svelte';
import type { DirtyNotifier } from './dirty-notifier';
import { EditorController } from './editor-controller.svelte';
import { Workspace } from './workspace.svelte';

export interface CreateEditorControllerOptions {
	readonly notifier: DirtyNotifier;
	readonly gridColor?: string;
	readonly initialForegroundColor?: Color;
	readonly restored?: WorkspaceSnapshot;
}

/**
 * Composition root for the editor session. Assembles `Workspace`,
 * `KeyboardInput`, and `EditorController` with the correct port bindings.
 *
 * The keyboard ↔ tool-runner circular reference is resolved by forward-
 * declaring `workspaceRef` and closing over it inside the keyboard host
 * callbacks. Callbacks fire only in response to user input, by which point
 * `workspaceRef` has been assigned — no ordering issue surfaces at runtime.
 */
export function createEditorController(
	options: CreateEditorControllerOptions
): EditorController {
	let workspaceRef: Workspace | null = null;

	const constrainLatch = new ConstrainLatch();

	const keyboard: KeyboardInput = createKeyboardInput({
		isDrawing: () => workspaceRef?.activeTab.isDrawing ?? false,
		getActiveTool: () => workspaceRef?.shared.activeTool ?? 'pencil',
		setActiveTool: (tool) => workspaceRef?.setActiveTool(tool),
		undo: () => workspaceRef?.activeTab.undo(),
		redo: () => workspaceRef?.activeTab.redo(),
		toggleGrid: () => workspaceRef?.activeTab.toggleGrid(),
		swapColors: () => workspaceRef?.swapColors(),
		clearMarqueeOrFloating: () => workspaceRef?.activeTab.clearMarqueeOrFloating(),
		clearMarqueePixels: () => workspaceRef?.activeTab.clearMarqueePixels(),
		copySelection: () => workspaceRef?.copySelection(),
		cutSelection: () => workspaceRef?.cutSelection(),
		pasteSelectionClipboard: () => workspaceRef?.pasteSelectionClipboard(),
		nudgeMarquee: (dx, dy) => workspaceRef?.activeTab.nudgeMarquee(dx, dy),
		notifyModifierChange: () => workspaceRef?.activeTab.modifierChanged()
	});

	const workspace = new Workspace({
		notifier: options.notifier,
		// The held-modifier state every constrainable tool reads is the OR of
		// keyboard Shift and the touch Constrain latch — either source alone
		// constrains, so a hybrid device can use whichever is convenient.
		keyboard: { getShiftHeld: () => keyboard.isShiftHeld || constrainLatch.isActive },
		gridColor: options.gridColor,
		initialForegroundColor: options.initialForegroundColor,
		restored: options.restored
	});
	workspaceRef = workspace;

	return new EditorController(workspace, keyboard, constrainLatch);
}
