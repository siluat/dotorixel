import type { ViewportData } from './viewport';
import type { SelectionClipboardData } from './canvas-model';
import type { ReferenceImage } from '$lib/reference-images/reference-image-types';
import type { ReferenceWindowState } from '$lib/reference-images/reference-window-state-types';
import type {
	MarqueeRecord,
	PixelLayerRecord,
	ReferenceLayerRecord
} from '$lib/session/session-storage-types';

export interface ReferenceLayerSnapshot extends ReferenceLayerRecord {
	readonly sourceRgba: Uint8Array;
}

export type LayerSnapshot = PixelLayerRecord | ReferenceLayerSnapshot;

export interface SharedStateSnapshot {
	readonly activeTool: string;
	readonly foregroundColor: { r: number; g: number; b: number; a: number };
	readonly backgroundColor: { r: number; g: number; b: number; a: number };
	readonly recentColors: readonly string[];
	/**
	 * Undefined on snapshots produced before this field existed. Hydration
	 * should treat absence as "use the default (ON)".
	 */
	readonly pixelPerfect?: boolean;
	/**
	 * Undefined on snapshots produced before this field existed. Hydration
	 * should treat absence as "empty clipboard".
	 */
	readonly selectionClipboard?: SelectionClipboardData | null;
}

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
	readonly sharedState: SharedStateSnapshot;
	/**
	 * Per-doc reference images. Undefined on snapshots produced before this
	 * field existed; hydration should treat absence as "empty map".
	 */
	readonly references?: Readonly<Record<string, readonly ReferenceImage[]>>;
	/**
	 * Per-doc Reference Window States. Undefined on snapshots produced before
	 * this field existed; hydration should treat absence as "empty map". The
	 * field name mirrors the persisted `displayStates` storage key.
	 */
	readonly displayStates?: Readonly<Record<string, readonly ReferenceWindowState[]>>;
}

export interface TabSnapshot {
	readonly id: string;
	readonly name: string;
	readonly width: number;
	readonly height: number;
	/**
	 * Undefined on snapshots produced before Marquee persistence. Hydration
	 * should treat absence as "no Marquee".
	 */
	readonly marquee?: MarqueeRecord | null;
	readonly layers: readonly LayerSnapshot[];
	readonly activeLayerId: string;
	readonly nextLayerNumber: number;
	readonly timelinePanelCollapsed: boolean;
	readonly viewport: ViewportData;
}
