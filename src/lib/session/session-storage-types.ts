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
export type StoredDocument = DocumentSchemaV1 | DocumentSchemaV2;

/** App-facing document type — always the latest version */
export type DocumentRecord = DocumentSchemaV2;

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
}
