/**
 * Plain-data snapshot of the entire workspace, suitable for persistence.
 * Contains no class instances, no reactive proxies — just serializable data.
 *
 * The sharedState nesting mirrors the IndexedDB WorkspaceRecord shape,
 * keeping the mapping in SessionPersistence straightforward.
 */
export interface WorkspaceSnapshot {
	readonly tabs: readonly TabSnapshot[];
	readonly activeTabIndex: number;
	readonly sharedState: {
		readonly activeTool: string;
		readonly foregroundColor: { r: number; g: number; b: number; a: number };
		readonly backgroundColor: { r: number; g: number; b: number; a: number };
		readonly recentColors: readonly string[];
	};
}

export interface TabSnapshot {
	readonly id: string;
	readonly name: string;
	readonly width: number;
	readonly height: number;
	readonly pixels: Uint8Array;
	readonly viewport: {
		readonly pixelSize: number;
		readonly zoom: number;
		readonly panX: number;
		readonly panY: number;
		readonly showGrid: boolean;
		readonly gridColor: string;
	};
}
