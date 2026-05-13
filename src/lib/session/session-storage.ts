import { openDB, type IDBPDatabase } from 'idb';
import type {
	DocumentRecord,
	SavedDocumentSummary,
	StoredDocument,
	WorkspaceRecord
} from './session-storage-types';
import {
	compositeV3,
	migrateDocumentToV2,
	migrateV2ToV3
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
const DB_VERSION = 3;

function normalizeToV3(stored: StoredDocument): DocumentRecord {
	if ('schemaVersion' in stored) {
		if (stored.schemaVersion === 3) return stored;
		if (stored.schemaVersion === 2) return migrateV2ToV3(stored);
		throw new Error(
			`Unsupported document schemaVersion: ${(stored as { schemaVersion: number }).schemaVersion}`
		);
	}
	return migrateV2ToV3(migrateDocumentToV2(stored));
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
			}
		});
		return new SessionStorage(db);
	}

	/** Read a document, normalizing any historical version to the current schema. */
	async getDocument(id: string): Promise<DocumentRecord | undefined> {
		const stored = await this.#db.get('documents', id);
		if (!stored) return undefined;
		return normalizeToV3(stored);
	}

	async putDocument(doc: DocumentRecord): Promise<void> {
		await this.#db.put('documents', doc);
	}

	/** Returns saved documents sorted by most recently modified first. */
	async getAllSavedDocuments(): Promise<SavedDocumentSummary[]> {
		const all = await this.#db.getAllFromIndex('documents', 'updatedAt');
		const saved: SavedDocumentSummary[] = [];
		for (const doc of all) {
			const record = normalizeToV3(doc);
			if (!record.saved) continue;
			saved.push({
				id: record.id,
				name: record.name,
				width: record.width,
				height: record.height,
				pixels: compositeV3(record),
				updatedAt: record.updatedAt
			});
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
