import type { TabSnapshot } from './workspace-snapshot';
import type { ViewportData } from './viewport';

export const FIXTURE_VIEWPORT: ViewportData = {
	pixelSize: 32,
	zoom: 1.0,
	panX: 0,
	panY: 0,
	showGrid: true,
	gridColor: '#cccccc'
};

export interface TabSnapshotFixtureOpts {
	id?: string;
	name?: string;
	width?: number;
	height?: number;
	pixels?: Uint8Array;
	layerName?: string;
	viewport?: ViewportData;
}

/**
 * Builds a single-layer [`TabSnapshot`] for tests. Defaults match the smallest
 * usable shape (1×1, zero buffer); callers needing larger documents must pass
 * `width`/`height` (and a matching `pixels` buffer if they care about content).
 */
export function tabSnapshotFixture(opts: TabSnapshotFixtureOpts = {}): TabSnapshot {
	const id = opts.id ?? 'doc-1';
	const width = opts.width ?? 1;
	const height = opts.height ?? 1;
	const layerId = crypto.randomUUID();
	return {
		id,
		name: opts.name ?? id,
		width,
		height,
		layers: [
			{
				kind: 'pixel',
				id: layerId,
				name: opts.layerName ?? 'Layer 1',
				pixels: opts.pixels ?? new Uint8Array(width * height * 4),
				visible: true,
				opacity: 1
			}
		],
		activeLayerId: layerId,
		nextLayerNumber: 2,
		timelinePanelCollapsed: false,
		viewport: opts.viewport ?? FIXTURE_VIEWPORT
	};
}
