import type { ToolType } from './tool-types';
import type { Color } from './color';

export class SharedState {
	activeTool = $state<ToolType>('pencil');
	foregroundColor = $state<Color>({ r: 0, g: 0, b: 0, a: 255 });
	backgroundColor = $state<Color>({ r: 255, g: 255, b: 255, a: 255 });
	recentColors = $state<string[]>([]);
}
