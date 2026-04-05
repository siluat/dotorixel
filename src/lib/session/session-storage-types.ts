import type { ToolType } from '$lib/canvas/tool-types';
import type { Color } from '$lib/canvas/color';

export interface DocumentRecord {
	id: string;
	name: string;
	width: number;
	height: number;
	pixels: Uint8Array;
	createdAt: Date;
	updatedAt: Date;
}

export interface ViewportRecord {
	pixelSize: number;
	zoom: number;
	panX: number;
	panY: number;
	showGrid: boolean;
	gridColor: string;
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
	viewports: Record<string, ViewportRecord>;
}
