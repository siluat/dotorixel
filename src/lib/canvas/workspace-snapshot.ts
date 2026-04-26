import type { ViewportData } from './viewport';
import type { ReferenceImage } from '$lib/reference-images/reference-image-types';
import type { DisplayState } from '$lib/reference-images/display-state-types';

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
	 * Per-doc reference window display states. Undefined on snapshots produced
	 * before this field existed; hydration should treat absence as "empty map".
	 */
	readonly displayStates?: Readonly<Record<string, readonly DisplayState[]>>;
}

export interface TabSnapshot {
	readonly id: string;
	readonly name: string;
	readonly width: number;
	readonly height: number;
	readonly pixels: Uint8Array;
	readonly viewport: ViewportData;
}
