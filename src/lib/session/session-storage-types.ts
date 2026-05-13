/** Schema V1 — initial document format */
export interface DocumentSchemaV1 {
	id: string;
	name: string;
	width: number;
	height: number;
	pixels: Uint8Array;
	createdAt: Date;
	updatedAt: Date;
}

/** Schema V2 — added schemaVersion discriminant and saved flag */
export interface DocumentSchemaV2 extends DocumentSchemaV1 {
	schemaVersion: 2;
	/**
	 * Whether the user explicitly chose to keep this document.
	 * New documents start as `false`. Set to `true` by the save dialog
	 * when the user closes a tab and chooses to save.
	 */
	saved: boolean;
}

/** What IndexedDB may contain — union of all historical versions */
export type StoredDocument = DocumentSchemaV1 | DocumentSchemaV2 | DocumentSchemaV3;

/** App-facing document type — always the latest version */
export type DocumentRecord = DocumentSchemaV3;

/** Lightweight summary for browsing saved documents (excludes schemaVersion, saved, createdAt) */
export interface SavedDocumentSummary {
	id: string;
	name: string;
	width: number;
	height: number;
	pixels: Uint8Array;
	updatedAt: Date;
}

export function migrateDocumentToV2(doc: DocumentSchemaV1): DocumentSchemaV2 {
	return { ...doc, schemaVersion: 2, saved: true };
}

/** Schema V3 — single canvas replaced by a Document with a layer stack */
export interface LayerRecord {
	id: string;
	name: string;
	pixels: Uint8Array;
	visible: boolean;
	opacity: number;
}

export interface DocumentSchemaV3 {
	schemaVersion: 3;
	id: string;
	name: string;
	width: number;
	height: number;
	layers: LayerRecord[];
	activeLayerId: string;
	nextLayerNumber: number;
	timelinePanelCollapsed: boolean;
	saved: boolean;
	createdAt: Date;
	updatedAt: Date;
}

/**
 * Wraps a V2 single-canvas document as a V3 Document with one "Layer 1".
 * History is dropped — V2 single-canvas snapshots are incompatible with the
 * Document shape and the migrated session starts with an empty history.
 */
export function migrateV2ToV3(doc: DocumentSchemaV2): DocumentSchemaV3 {
	const layerId = crypto.randomUUID();
	return {
		schemaVersion: 3,
		id: doc.id,
		name: doc.name,
		width: doc.width,
		height: doc.height,
		layers: [
			{
				id: layerId,
				name: 'Layer 1',
				pixels: doc.pixels.slice(),
				visible: true,
				opacity: 1
			}
		],
		activeLayerId: layerId,
		nextLayerNumber: 2,
		timelinePanelCollapsed: false,
		saved: doc.saved,
		createdAt: doc.createdAt,
		updatedAt: doc.updatedAt
	};
}

/**
 * Source-over composite of every visible layer at its declared opacity.
 * Used to build a single thumbnail buffer for the saved-work browser — the
 * Rust core renders the in-editor canvas via a parallel implementation, so
 * minor numeric differences here are tolerated.
 */
export function compositeV3(doc: DocumentSchemaV3): Uint8Array {
	const out = new Uint8Array(doc.width * doc.height * 4);
	for (const layer of doc.layers) {
		if (!layer.visible || layer.opacity <= 0) continue;
		const src = layer.pixels;
		for (let i = 0; i < out.length; i += 4) {
			const srcAlpha = (src[i + 3] / 255) * layer.opacity;
			if (srcAlpha <= 0) continue;
			const dstAlpha = out[i + 3] / 255;
			const outAlpha = srcAlpha + dstAlpha * (1 - srcAlpha);
			if (outAlpha <= 0) continue;
			const dstWeight = dstAlpha * (1 - srcAlpha);
			out[i] = Math.round((src[i] * srcAlpha + out[i] * dstWeight) / outAlpha);
			out[i + 1] = Math.round((src[i + 1] * srcAlpha + out[i + 1] * dstWeight) / outAlpha);
			out[i + 2] = Math.round((src[i + 2] * srcAlpha + out[i + 2] * dstWeight) / outAlpha);
			out[i + 3] = Math.round(outAlpha * 255);
		}
	}
	return out;
}

export interface SharedStateRecord {
	activeTool: string;
	foregroundColor: { r: number; g: number; b: number; a: number };
	backgroundColor: { r: number; g: number; b: number; a: number };
	recentColors: string[];
	/**
	 * Absent on records written before this field existed. Hydration should
	 * treat absence as "use the default (ON)".
	 */
	pixelPerfect?: boolean;
}

export interface ViewportRecord {
	pixelSize: number;
	zoom: number;
	panX: number;
	panY: number;
	showGrid: boolean;
	gridColor: string;
}

export interface ReferenceImageRecord {
	id: string;
	filename: string;
	blob: Blob;
	thumbnail: Blob;
	mimeType: string;
	naturalWidth: number;
	naturalHeight: number;
	byteSize: number;
	addedAt: Date;
}

export interface DisplayStateRecord {
	refId: string;
	visible: boolean;
	x: number;
	y: number;
	width: number;
	height: number;
	minimized: boolean;
	zOrder: number;
}

export interface WorkspaceRecord {
	id: string;
	tabOrder: string[];
	activeTabIndex: number;
	sharedState: SharedStateRecord;
	viewports: Record<string, ViewportRecord>;
	/**
	 * Absent on records written before this field existed. Hydration should
	 * treat absence as "empty map".
	 */
	references?: Record<string, ReferenceImageRecord[]>;
	/**
	 * Absent on records written before this field existed. Hydration should
	 * treat absence as "empty map".
	 */
	displayStates?: Record<string, DisplayStateRecord[]>;
}
