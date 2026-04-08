import {
	Pencil,
	Slash,
	Square,
	Circle,
	Eraser,
	PaintBucket,
	Pipette,
	Move
} from 'lucide-svelte';
import * as m from '$lib/paraglide/messages';
import { TOOL_TYPES, getToolDef, type ToolType } from '$lib/canvas/tool-registry';

export type { ToolType } from '$lib/canvas/tool-registry';

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
};

/** Ordered tool entries with merged core + UI metadata. */
export const TOOL_ENTRIES: readonly ToolUIEntry[] = TOOL_TYPES.map((type) => {
	const def = getToolDef(type);
	const ui = TOOL_UI[type];
	return { type, icon: ui.icon, label: ui.label, shortcutKey: def.shortcutKey, cursor: def.cursor };
});
