import type { Color } from '../color';
import type { WorkspaceSnapshot } from '../workspace-snapshot';
import { createKeyboardInput, type KeyboardInput } from '../keyboard-input.svelte';
import type { CanvasBackend } from './canvas-backend';
import type { DirtyNotifier } from './dirty-notifier';
import { EditorController } from './editor-controller.svelte';
import { Workspace } from './workspace.svelte';

export interface CreateEditorControllerOptions {
	readonly backend: CanvasBackend;
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

	const keyboard: KeyboardInput = createKeyboardInput({
		isDrawing: () => workspaceRef?.activeTab.isDrawing ?? false,
		getActiveTool: () => workspaceRef?.shared.activeTool ?? 'pencil',
		setActiveTool: (tool) => workspaceRef?.setActiveTool(tool),
		undo: () => workspaceRef?.activeTab.undo(),
		redo: () => workspaceRef?.activeTab.redo(),
		toggleGrid: () => workspaceRef?.activeTab.toggleGrid(),
		swapColors: () => workspaceRef?.swapColors(),
		notifyModifierChange: () => workspaceRef?.activeTab.modifierChanged()
	});

	const workspace = new Workspace({
		backend: options.backend,
		notifier: options.notifier,
		keyboard: { getShiftHeld: () => keyboard.isShiftHeld },
		gridColor: options.gridColor,
		initialForegroundColor: options.initialForegroundColor,
		restored: options.restored
	});
	workspaceRef = workspace;

	return new EditorController(workspace, keyboard);
}
