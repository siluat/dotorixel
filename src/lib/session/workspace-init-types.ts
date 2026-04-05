import type { ToolType } from '$lib/canvas/tool-types';
import type { Color } from '$lib/canvas/color';

export interface ViewportInit {
	pixelSize: number;
	zoom: number;
	panX: number;
	panY: number;
	showGrid: boolean;
	gridColor: string;
}

export interface SharedStateInit {
	activeTool: ToolType;
	foregroundColor: Color;
	backgroundColor: Color;
	recentColors: string[];
}

export interface TabInit {
	id: string;
	name: string;
	width: number;
	height: number;
	pixels: Uint8Array;
	viewport: ViewportInit;
}

export interface WorkspaceInit {
	tabs: TabInit[];
	activeTabIndex: number;
	sharedState: SharedStateInit;
}
