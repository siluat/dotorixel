export type ToolType = 'pencil' | 'eraser' | 'line' | 'rectangle' | 'ellipse' | 'floodfill' | 'eyedropper' | 'move';

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
