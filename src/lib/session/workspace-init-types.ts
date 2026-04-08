export interface SharedStateInit {
	activeTool: string;
	foregroundColor: { r: number; g: number; b: number; a: number };
	backgroundColor: { r: number; g: number; b: number; a: number };
	recentColors: string[];
}

export interface TabInit {
	id: string;
	name: string;
	width: number;
	height: number;
	pixels: Uint8Array;
	viewport: {
		pixelSize: number;
		zoom: number;
		panX: number;
		panY: number;
		showGrid: boolean;
		gridColor: string;
	};
}

export interface WorkspaceInit {
	tabs: TabInit[];
	activeTabIndex: number;
	sharedState: SharedStateInit;
}
