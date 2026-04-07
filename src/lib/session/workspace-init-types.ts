import type { ToolType } from '$lib/canvas/tool-types';
import type { Color } from '$lib/canvas/color';
import type { ViewportData } from '$lib/canvas/view-types';

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
	viewport: ViewportData;
}

export interface WorkspaceInit {
	tabs: TabInit[];
	activeTabIndex: number;
	sharedState: SharedStateInit;
}
