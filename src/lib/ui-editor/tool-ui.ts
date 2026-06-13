import {
	Pencil,
	Slash,
	Square,
	SquareDashed,
	Circle,
	Eraser,
	PaintBucket,
	Pipette,
	Move
} from 'lucide-svelte';
import * as m from '$lib/paraglide/messages';
import { TOOL_TYPES, getToolDef, isConstrainableTool, type ToolType } from '$lib/canvas/tool-registry';

export type { ToolType } from '$lib/canvas/tool-registry';

/**
 * A tap or click on the already-active tool toggles the Constrain latch when
 * that tool can constrain. Shared by every toolbar that renders tool buttons
 * (touch strip, docked toolbar) so the gesture means the same thing everywhere.
 */
export function isConstrainToggleTap(tool: ToolType, activeTool: ToolType): boolean {
	return tool === activeTool && isConstrainableTool(tool);
}

/** Whether a tool button should carry the Constrain dot indicating the latched state. */
export function showsConstrainState(
	tool: ToolType,
	activeTool: ToolType,
	constrainActive: boolean
): boolean {
	return constrainActive && isConstrainToggleTap(tool, activeTool);
}

/**
 * The keyboard intent for a key pressed while a tool radio is focused. `select`
 * moves the radiogroup selection (and focus) to a sibling tool; `activate` is the
 * keyboard equivalent of re-tapping the focused tool (toggles the Constrain latch
 * on a constrainable tool, re-selects otherwise). `null` means leave the key for
 * global handlers. Shared by every toolbar so navigation behaves identically.
 */
export type ToolRadiogroupAction = { kind: 'select'; tool: ToolType } | { kind: 'activate' };

export function toolRadiogroupAction(
	key: string,
	activeTool: ToolType
): ToolRadiogroupAction | null {
	const count = TOOL_ENTRIES.length;
	const index = TOOL_ENTRIES.findIndex((entry) => entry.type === activeTool);
	switch (key) {
		case 'ArrowRight':
		case 'ArrowDown':
			return { kind: 'select', tool: TOOL_ENTRIES[(index + 1) % count].type };
		case 'ArrowLeft':
		case 'ArrowUp':
			return { kind: 'select', tool: TOOL_ENTRIES[(index - 1 + count) % count].type };
		case ' ':
		case 'Enter':
			return { kind: 'activate' };
		default:
			return null;
	}
}

/** Full-sentence Constrain-latch description for the toolbar's polite status region. */
export function constrainStatusMessage(constrainActive: boolean): string {
	return constrainActive ? m.aria_constrainStatusOn() : m.aria_constrainStatusOff();
}

/** The toolbar wiring a tool activation needs, independent of which surface renders it. */
export interface ToolActivation {
	readonly activeTool: ToolType;
	readonly onToolChange: (tool: ToolType) => void;
	readonly onToggleConstrain: () => void;
}

/**
 * Activate a tool the way a pointer tap or keyboard press does: re-activating the
 * already-active constrainable tool toggles the Constrain latch, anything else
 * selects. Shared so every toolbar surface means the same by the same gesture.
 */
export function activateTool(tool: ToolType, activation: ToolActivation): void {
	if (isConstrainToggleTap(tool, activation.activeTool)) {
		activation.onToggleConstrain();
	} else {
		activation.onToolChange(tool);
	}
}

/**
 * Handle a keydown while a tool radio is focused: Arrow keys move the selection
 * (and focus, via the surface's `focusTool`), Space/Enter activate the focused
 * tool. preventDefault keeps handled keys from leaking into the window-level
 * shortcuts (Space pan, arrow nudge) that share these keys.
 */
export function handleToolRadiogroupKeydown(
	event: KeyboardEvent,
	activation: ToolActivation,
	focusTool: (tool: ToolType) => void
): void {
	const action = toolRadiogroupAction(event.key, activation.activeTool);
	if (!action) return;
	event.preventDefault();
	if (action.kind === 'select') {
		activation.onToolChange(action.tool);
		focusTool(action.tool);
	} else {
		activateTool(activation.activeTool, activation);
	}
}

/** Merged core + UI metadata for a single tool. */
export interface ToolUIEntry {
	readonly type: ToolType;
	readonly icon: typeof Pencil;
	readonly label: () => string;
	readonly shortcutKey: string;
	readonly cursor: string;
}

/** Record<ToolType, ...> ensures compile error if a tool is missing. */
const TOOL_UI: Record<ToolType, { icon: typeof Pencil; label: () => string }> = {
	pencil: { icon: Pencil, label: m.tool_pencil },
	line: { icon: Slash, label: m.tool_line },
	rectangle: { icon: Square, label: m.tool_rectangle },
	ellipse: { icon: Circle, label: m.tool_ellipse },
	eraser: { icon: Eraser, label: m.tool_eraser },
	floodfill: { icon: PaintBucket, label: m.tool_floodfill },
	eyedropper: { icon: Pipette, label: m.tool_eyedropper },
	move: { icon: Move, label: m.tool_move },
	selection: { icon: SquareDashed, label: m.tool_selection },
};

/** Ordered tool entries with merged core + UI metadata. */
export const TOOL_ENTRIES: readonly ToolUIEntry[] = TOOL_TYPES.map((type) => {
	const def = getToolDef(type);
	const ui = TOOL_UI[type];
	return { type, icon: ui.icon, label: ui.label, shortcutKey: def.shortcutKey, cursor: def.cursor };
});
