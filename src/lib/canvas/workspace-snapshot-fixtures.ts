import type { TabSnapshot } from './workspace-snapshot';
import type { ViewportData } from './viewport';
import { DEFAULT_FRAME_DURATION_MS } from '$lib/session/session-storage-types';

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
	/** The lone frame's Cel pixels. Ignored when `cels` is given. */
	pixels?: Uint8Array;
	/** One Cel per frame — defines a multi-frame axis. Overrides `pixels`. */
	cels?: { frameId: string; pixels: Uint8Array }[];
	/** Per-frame durations (ms), aligned to the frame axis. Defaults each frame to `DEFAULT_FRAME_DURATION_MS`. */
	frameDurationsMs?: number[];
	layerName?: string;
	viewport?: ViewportData;
}

/**
 * Builds a single-layer [`TabSnapshot`] for tests. Defaults match the smallest
 * usable shape (1×1, zero buffer, one frame); callers needing larger documents
 * pass `width`/`height` (and a matching `pixels` buffer), or `cels` for a
 * multi-frame axis.
 */
export function tabSnapshotFixture(opts: TabSnapshotFixtureOpts = {}): TabSnapshot {
	const id = opts.id ?? 'doc-1';
	const width = opts.width ?? 1;
	const height = opts.height ?? 1;
	const layerId = crypto.randomUUID();
	const cels = opts.cels ?? [
		{ frameId: crypto.randomUUID(), pixels: opts.pixels ?? new Uint8Array(width * height * 4) }
	];
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
				cels: cels.map((cel) => ({ frameId: cel.frameId, pixels: cel.pixels })),
				visible: true,
				opacity: 1
			}
		],
		frames: cels.map((cel, index) => ({
			id: cel.frameId,
			durationMs: opts.frameDurationsMs?.[index] ?? DEFAULT_FRAME_DURATION_MS
		})),
		activeFrameId: cels[0].frameId,
		activeLayerId: layerId,
		nextLayerNumber: 2,
		timelinePanelCollapsed: false,
		viewport: opts.viewport ?? FIXTURE_VIEWPORT
	};
}
