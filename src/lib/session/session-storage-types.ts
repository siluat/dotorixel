import type { ToolType } from '$lib/canvas/tool-types';
import type { Color } from '$lib/canvas/color';
import type { ViewportData } from '$lib/canvas/view-types';

export interface DocumentRecord {
	id: string;
	name: string;
	width: number;
	height: number;
	pixels: Uint8Array;
	createdAt: Date;
	updatedAt: Date;
}

export interface SharedStateRecord {
	activeTool: ToolType;
	foregroundColor: Color;
	backgroundColor: Color;
	recentColors: string[];
}

export interface WorkspaceRecord {
	id: string;
	tabOrder: string[];
	activeTabIndex: number;
	sharedState: SharedStateRecord;
	viewports: Record<string, ViewportData>;
}
