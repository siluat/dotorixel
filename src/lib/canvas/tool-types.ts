export type ToolType = 'pencil' | 'eraser' | 'line' | 'rectangle' | 'ellipse' | 'floodfill' | 'eyedropper' | 'move';

const TOOL_TYPES: ReadonlySet<string> = new Set<ToolType>([
	'pencil', 'eraser', 'line', 'rectangle', 'ellipse', 'floodfill', 'eyedropper', 'move'
]);

export function isValidToolType(value: string): value is ToolType {
	return TOOL_TYPES.has(value);
}

export const TOOL_CURSORS: Record<ToolType, string> = {
	pencil: 'crosshair',
	eraser: 'crosshair',
	line: 'crosshair',
	rectangle: 'crosshair',
	ellipse: 'crosshair',
	floodfill: 'crosshair',
	eyedropper: 'crosshair',
	move: 'move'
};
