import { openDB, type IDBPDatabase } from 'idb';
import type { DocumentRecord, StoredDocument, WorkspaceRecord } from './session-storage-types';
import { migrateDocumentToV2 } from './session-storage-types';

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
const DB_VERSION = 2;

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
			}
		});
		return new SessionStorage(db);
	}

	/** Read a document, normalizing any historical version to the current schema. */
	async getDocument(id: string): Promise<DocumentRecord | undefined> {
		const stored = await this.#db.get('documents', id);
		if (!stored) return undefined;
		if ('schemaVersion' in stored) return stored;
		return migrateDocumentToV2(stored);
	}

	async putDocument(doc: DocumentRecord): Promise<void> {
		await this.#db.put('documents', doc);
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
