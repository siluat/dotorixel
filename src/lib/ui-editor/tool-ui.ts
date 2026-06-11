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

/** Whether a tool button should carry the Constrain dot and announce the latched state. */
export function showsConstrainState(
	tool: ToolType,
	activeTool: ToolType,
	constrainActive: boolean
): boolean {
	return constrainActive && isConstrainToggleTap(tool, activeTool);
}

/** Accessible button label for a tool, announcing the Constrain state while latched. */
export function toolButtonLabel(
	entry: Pick<ToolUIEntry, 'type' | 'label'>,
	activeTool: ToolType,
	constrainActive: boolean
): string {
	return showsConstrainState(entry.type, activeTool, constrainActive)
		? `${entry.label()} (${m.modifier_constrain()})`
		: entry.label();
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
