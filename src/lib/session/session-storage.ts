import { openDB, type IDBPDatabase } from 'idb';
import type {
	DocumentRecord,
	SavedDocumentSummary,
	StoredDocument,
	WorkspaceRecord
} from './session-storage-types';
import {
	compositeForExportSummary,
	migrateDocumentToV2,
	migrateV2ToV3,
	migrateV3ToV4,
	migrateV4ToV5,
	migrateV5ToV6,
	migrateV6ToV7
} from './session-storage-types';

interface DotorixelDB {
	documents: {
		key: string;
		value: StoredDocument;
		indexes: { updatedAt: Date };
	};
	workspace: {
		key: string;
		value: WorkspaceRecord;
	};
}

const DB_NAME = 'dotorixel';
const DB_VERSION = 7;

function normalizeToV7(stored: StoredDocument): DocumentRecord {
	if ('schemaVersion' in stored) {
		if (stored.schemaVersion === 7) return stored;
		if (stored.schemaVersion === 6) return migrateV6ToV7(stored);
		// V5 still routes through migrateV4ToV5 to re-normalize legacy Reference
		// Layer order (single bottom-most underlay) before gaining the frame axis.
		if (stored.schemaVersion === 5) return migrateV6ToV7(migrateV5ToV6(migrateV4ToV5(stored)));
		if (stored.schemaVersion === 4) return migrateV6ToV7(migrateV5ToV6(migrateV4ToV5(stored)));
		if (stored.schemaVersion === 3)
			return migrateV6ToV7(migrateV5ToV6(migrateV4ToV5(migrateV3ToV4(stored))));
		if (stored.schemaVersion === 2)
			return migrateV6ToV7(migrateV5ToV6(migrateV4ToV5(migrateV3ToV4(migrateV2ToV3(stored)))));
		throw new Error(
			`Unsupported document schemaVersion: ${(stored as { schemaVersion: number }).schemaVersion}`
		);
	}
	return migrateV6ToV7(
		migrateV5ToV6(migrateV4ToV5(migrateV3ToV4(migrateV2ToV3(migrateDocumentToV2(stored)))))
	);
}

export class SessionStorage {
	#db: IDBPDatabase<DotorixelDB>;

	private constructor(db: IDBPDatabase<DotorixelDB>) {
		this.#db = db;
	}

	static async open(): Promise<SessionStorage> {
		const db = await openDB<DotorixelDB>(DB_NAME, DB_VERSION, {
			async upgrade(db, oldVersion, _newVersion, tx) {
				if (oldVersion < 1) {
					const docStore = db.createObjectStore('documents', { keyPath: 'id' });
					docStore.createIndex('updatedAt', 'updatedAt');
					db.createObjectStore('workspace', { keyPath: 'id' });
				}
				if (oldVersion < 2) {
					const store = tx.objectStore('documents');
					let cursor = await store.openCursor();
					while (cursor) {
						const doc = cursor.value;
						if (!('schemaVersion' in doc)) {
							await cursor.update(migrateDocumentToV2(doc));
						}
						cursor = await cursor.continue();
					}
				}
				if (oldVersion < 3) {
					const store = tx.objectStore('documents');
					let cursor = await store.openCursor();
					while (cursor) {
						const doc = cursor.value;
						if ('schemaVersion' in doc && doc.schemaVersion === 2) {
							await cursor.update(migrateV2ToV3(doc));
						}
						cursor = await cursor.continue();
					}
				}
				if (oldVersion < 4) {
					const store = tx.objectStore('documents');
					let cursor = await store.openCursor();
					while (cursor) {
						const doc = cursor.value;
						if ('schemaVersion' in doc && doc.schemaVersion === 3) {
							await cursor.update(migrateV3ToV4(doc));
						}
						cursor = await cursor.continue();
					}
				}
				if (oldVersion < 5) {
					const store = tx.objectStore('documents');
					let cursor = await store.openCursor();
					while (cursor) {
						const doc = cursor.value;
						if ('schemaVersion' in doc && doc.schemaVersion === 4) {
							await cursor.update(migrateV4ToV5(doc));
						}
						cursor = await cursor.continue();
					}
				}
				if (oldVersion < 6) {
					const store = tx.objectStore('documents');
					let cursor = await store.openCursor();
					while (cursor) {
						const doc = cursor.value;
						if ('schemaVersion' in doc && doc.schemaVersion === 5) {
							try {
								// Route through migrateV4ToV5 to re-normalize legacy Reference
								// order, matching the read-path dispatch. One unmigratable record
								// must not abort the whole upgrade — that would fail the DB open.
								await cursor.update(migrateV5ToV6(migrateV4ToV5(doc)));
							} catch (error) {
								console.warn(`Skipping unmigratable V5 document ${doc.id}`, error);
							}
						}
						cursor = await cursor.continue();
					}
				}
				if (oldVersion < 7) {
					const store = tx.objectStore('documents');
					let cursor = await store.openCursor();
					while (cursor) {
						const doc = cursor.value;
						// Records from earlier versions were already chained up to V6 by the
						// blocks above, so a single V6 → V7 step here finishes every record.
						if ('schemaVersion' in doc && doc.schemaVersion === 6) {
							try {
								await cursor.update(migrateV6ToV7(doc));
							} catch (error) {
								console.warn(`Skipping unmigratable V6 document ${doc.id}`, error);
							}
						}
						cursor = await cursor.continue();
					}
				}
			}
		});
		return new SessionStorage(db);
	}

	/** Read a document, normalizing any historical version to the current schema. */
	async getDocument(id: string): Promise<DocumentRecord | undefined> {
		const stored = await this.#db.get('documents', id);
		if (!stored) return undefined;
		return normalizeToV7(stored);
	}

	async putDocument(doc: DocumentRecord): Promise<void> {
		await this.#db.put('documents', doc);
	}

	/** Returns saved documents sorted by most recently modified first. */
	async getAllSavedDocuments(): Promise<SavedDocumentSummary[]> {
		const all = await this.#db.getAllFromIndex('documents', 'updatedAt');
		const saved: SavedDocumentSummary[] = [];
		for (const doc of all) {
			try {
				const record = normalizeToV7(doc);
				if (!record.saved) continue;
				saved.push({
					id: record.id,
					name: record.name,
					width: record.width,
					height: record.height,
					pixels: compositeForExportSummary(record),
					updatedAt: record.updatedAt
				});
			} catch (error) {
				// One unreadable record must not break the whole saved-work browser;
				// skip it and keep listing the rest (mirrors restore()'s fallback).
				console.warn(`Skipping unreadable saved document ${doc.id}`, error);
			}
		}
		saved.reverse();
		return saved;
	}

	async deleteDocument(id: string): Promise<void> {
		await this.#db.delete('documents', id);
	}

	async getWorkspace(): Promise<WorkspaceRecord | undefined> {
		return this.#db.get('workspace', 'current');
	}

	async putWorkspace(ws: WorkspaceRecord): Promise<void> {
		await this.#db.put('workspace', ws);
	}

	close(): void {
		this.#db.close();
	}
}
