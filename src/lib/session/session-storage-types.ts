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

/**
 * What IndexedDB may contain — union of all versions wired into storage.
 */
export type StoredDocument =
	| DocumentSchemaV1
	| DocumentSchemaV2
	| DocumentSchemaV3
	| DocumentSchemaV4
	| DocumentSchemaV5
	| DocumentSchemaV6
	| DocumentSchemaV7;

/** App-facing document type — latest version wired into persistence call sites. */
export type DocumentRecord = DocumentSchemaV7;

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
export interface PixelLayerRecordV3 {
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
	layers: PixelLayerRecordV3[];
	activeLayerId: string;
	nextLayerNumber: number;
	timelinePanelCollapsed: boolean;
	saved: boolean;
	createdAt: Date;
	updatedAt: Date;
}

export interface ReferencePlacementRecord {
	x: number;
	y: number;
	scale: number;
	/**
	 * Number of 90° clockwise turns applied to the source image, in `0..=3`.
	 * Undefined on records written before reference rotation existed; hydration
	 * treats absence as 0 (no rotation).
	 */
	rotation?: number;
}

export interface PixelLayerRecord extends PixelLayerRecordV3 {
	kind: 'pixel';
}

export interface ReferenceLayerRecord {
	kind: 'reference';
	id: string;
	name: string;
	visible: boolean;
	opacity: number;
	sourceBlob: Blob;
	naturalWidth: number;
	naturalHeight: number;
	placement: ReferencePlacementRecord;
}

export type LayerRecord = PixelLayerRecord | ReferenceLayerRecord;

/** Schema V4 — mixed Pixel + Reference layer persistence. */
export type DocumentSchemaV4 = Omit<DocumentSchemaV3, 'schemaVersion' | 'layers'> & {
	schemaVersion: 4;
	layers: LayerRecord[];
};

export interface MarqueeRecord {
	x: number;
	y: number;
	width: number;
	height: number;
}

/** Schema V5 — persists the Document-scoped Marquee. */
export type DocumentSchemaV5 = Omit<DocumentSchemaV4, 'schemaVersion'> & {
	schemaVersion: 5;
	marquee: MarqueeRecord | null;
};

/**
 * The display duration (ms) a Frame defaults to when none is recorded — the TS
 * mirror of the core's `Frame::DEFAULT_DURATION_MS`. Single source of truth for
 * the value the V6 → V7 migration backfills onto duration-less frames.
 */
export const DEFAULT_FRAME_DURATION_MS = 100;

/**
 * A position on the Document's temporal axis — its identity plus the display
 * duration (`durationMs`) it is held during playback. Gained `durationMs` in
 * schema V7; the duration-less V6 shape is frozen as {@link FrameRecordV6}.
 */
export interface FrameRecord {
	id: string;
	/** How long the frame is held during playback, in milliseconds. */
	durationMs: number;
}

/** The frozen V6 Frame shape — identity only, before V7 added `durationMs`. */
export interface FrameRecordV6 {
	id: string;
}

/** One Pixel Layer's pixel buffer for one Frame — the (layer × frame) grid cell. */
export interface CelRecord {
	frameId: string;
	pixels: Uint8Array;
}

/**
 * V6 Pixel Layer record — one Cel per Frame, replacing V5's single `pixels`.
 * A Pixel Layer's cel keys equal the Document's frame ids (the grid invariant).
 */
export interface PixelLayerRecordV6 {
	kind: 'pixel';
	id: string;
	name: string;
	cels: CelRecord[];
	visible: boolean;
	opacity: number;
}

export type LayerRecordV6 = PixelLayerRecordV6 | ReferenceLayerRecord;

/** Schema V6 — adds the frame axis; each Pixel Layer holds one Cel per frame. */
export type DocumentSchemaV6 = Omit<DocumentSchemaV5, 'schemaVersion' | 'layers'> & {
	schemaVersion: 6;
	frames: FrameRecordV6[];
	activeFrameId: string;
	layers: LayerRecordV6[];
};

/** Schema V7 — each Frame carries its display `durationMs`; the cel grid is unchanged. */
export type DocumentSchemaV7 = Omit<DocumentSchemaV6, 'schemaVersion' | 'frames'> & {
	schemaVersion: 7;
	frames: FrameRecord[];
};

function isReferenceLayerRecord(layer: LayerRecord): layer is ReferenceLayerRecord {
	return layer.kind === 'reference';
}

function normalizeV4ReferenceLayer(doc: DocumentSchemaV4): DocumentSchemaV4 {
	let keptReferenceIndex = -1;
	for (let i = doc.layers.length - 1; i >= 0; i--) {
		if (isReferenceLayerRecord(doc.layers[i])) {
			keptReferenceIndex = i;
			break;
		}
	}
	if (keptReferenceIndex === -1) return doc;

	const keptReference = doc.layers[keptReferenceIndex] as ReferenceLayerRecord;
	const pixelLayers = doc.layers.filter(
		(layer): layer is PixelLayerRecord => layer.kind === 'pixel'
	);
	const normalizedLayers: LayerRecord[] = [keptReference, ...pixelLayers];
	const activeWasReference = doc.layers.some(
		(layer) => layer.id === doc.activeLayerId && layer.kind === 'reference'
	);
	const normalizedActiveLayerId = activeWasReference ? keptReference.id : doc.activeLayerId;
	const alreadyNormalized =
		normalizedActiveLayerId === doc.activeLayerId &&
		normalizedLayers.length === doc.layers.length &&
		normalizedLayers.every((layer, index) => layer === doc.layers[index]);

	if (alreadyNormalized) return doc;
	return {
		...doc,
		layers: normalizedLayers,
		activeLayerId: normalizedActiveLayerId
	};
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
 * Wraps every V3 layer as a V4 Pixel Layer.
 * History stays absent because legacy V3 snapshots have no layer-kind data.
 */
export function migrateV3ToV4(doc: DocumentSchemaV3 | DocumentSchemaV4): DocumentSchemaV4 {
	if (doc.schemaVersion === 4) return normalizeV4ReferenceLayer(doc);
	if (doc.layers.length === 0) {
		throw new Error('Cannot migrate a V3 document with no layers');
	}
	return {
		schemaVersion: 4,
		id: doc.id,
		name: doc.name,
		width: doc.width,
		height: doc.height,
		layers: doc.layers.map((layer) => ({
			kind: 'pixel',
			id: layer.id,
			name: layer.name,
			pixels: layer.pixels.slice(),
			visible: layer.visible,
			opacity: layer.opacity
		})),
		activeLayerId: doc.activeLayerId,
		nextLayerNumber: doc.nextLayerNumber,
		timelinePanelCollapsed: doc.timelinePanelCollapsed,
		saved: doc.saved,
		createdAt: doc.createdAt,
		updatedAt: doc.updatedAt
	};
}

/**
 * Migrates a V4 or V5 persisted document to schema V5.
 * V4 input is normalized through `normalizeV4ReferenceLayer` and receives no
 * Marquee; V5 input is normalized the same way and keeps a cloned Marquee when
 * one is already present.
 */
export function migrateV4ToV5(doc: DocumentSchemaV4 | DocumentSchemaV5): DocumentSchemaV5 {
	const v4 = normalizeV4ReferenceLayer({ ...doc, schemaVersion: 4 });
	return {
		...v4,
		schemaVersion: 5,
		marquee: doc.schemaVersion === 5 && doc.marquee ? { ...doc.marquee } : null
	};
}

/**
 * Migrates a V5 persisted document to schema V6 by synthesizing a single Frame.
 * Each Pixel Layer's single `pixels` becomes that frame's only Cel; the
 * Reference Layer is frame-independent and carried through unchanged.
 * `activeFrameId` points at the synthesized frame. No pixel loss; history
 * resets, consistent with prior schema migrations.
 */
export function migrateV5ToV6(doc: DocumentSchemaV5): DocumentSchemaV6 {
	const frameId = crypto.randomUUID();
	return {
		...doc,
		schemaVersion: 6,
		frames: [{ id: frameId }],
		activeFrameId: frameId,
		layers: doc.layers.map((layer) =>
			layer.kind === 'reference'
				? layer
				: {
						kind: 'pixel',
						id: layer.id,
						name: layer.name,
						cels: [{ frameId, pixels: layer.pixels.slice() }],
						visible: layer.visible,
						opacity: layer.opacity
					}
		)
	};
}

/**
 * Migrates a V6 persisted document to schema V7 by giving every Frame the
 * default display duration. Lossless: the cel grid, layers, `activeFrameId`,
 * and document metadata are untouched; history resets, consistent with prior
 * schema migrations.
 */
export function migrateV6ToV7(doc: DocumentSchemaV6): DocumentSchemaV7 {
	return {
		...doc,
		schemaVersion: 7,
		frames: doc.frames.map((frame) => ({ id: frame.id, durationMs: DEFAULT_FRAME_DURATION_MS }))
	};
}

/**
 * Source-over composite of every visible layer at its declared opacity.
 * Used to build a single thumbnail buffer for the saved-work browser. A
 * deliberate WASM-free parallel to the Rust core composite so the landing route
 * ships no wasm bundle; the two share one source-over formula and are pinned
 * together by `composite-parity.test.ts` — they agree to within 1 per channel,
 * the only gap being Rust `f32` vs JS `f64` rounding.
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

/**
 * The pixels of a Pixel Layer's Cel at a given Frame. The grid invariant
 * guarantees exactly one Cel per frame, so an absent Cel signals a corrupt
 * record rather than an expected state.
 */
export function celPixelsForFrame(layer: PixelLayerRecordV6, frameId: string): Uint8Array {
	const cel = layer.cels.find((entry) => entry.frameId === frameId);
	if (!cel) {
		throw new Error(`Pixel Layer ${layer.id} is missing a cel for frame ${frameId}`);
	}
	return cel.pixels;
}

/** Pixel-only composite for persistence summaries; Reference Layers are excluded. */
export function compositeForExportSummary(
	doc:
		| DocumentSchemaV3
		| DocumentSchemaV4
		| DocumentSchemaV5
		| DocumentSchemaV6
		| DocumentSchemaV7
): Uint8Array {
	if (doc.schemaVersion === 3) return compositeV3(doc);
	if (doc.schemaVersion === 6 || doc.schemaVersion === 7) {
		const pixelLayers = doc.layers
			.filter((layer): layer is PixelLayerRecordV6 => layer.kind === 'pixel')
			.map((layer) => ({
				id: layer.id,
				name: layer.name,
				pixels: celPixelsForFrame(layer, doc.activeFrameId),
				visible: layer.visible,
				opacity: layer.opacity
			}));
		return compositeV3({ ...doc, schemaVersion: 3, layers: pixelLayers });
	}
	const pixelLayers = doc.layers.filter(
		(layer): layer is PixelLayerRecord => layer.kind === 'pixel'
	);
	return compositeV3({ ...doc, schemaVersion: 3, layers: pixelLayers });
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
	/**
	 * Absent on records written before this field existed. Hydration should
	 * treat absence as "empty clipboard".
	 */
	selectionClipboard?: SelectionClipboardRecord | null;
}

export interface SelectionClipboardRecord {
	pixels: Uint8Array;
	width: number;
	height: number;
}

export interface ViewportRecord {
	pixelSize: number;
	zoom: number;
	panX: number;
	panY: number;
	showGrid: boolean;
	gridColor: string;
	/**
	 * Absent on records written before this field existed. Hydration should
	 * treat absence as "off".
	 */
	showOnionSkin?: boolean;
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
