import { openDB, type IDBPDatabase } from 'idb';
import type { DocumentRecord, WorkspaceRecord } from './session-storage-types';

interface DotorixelDB {
	documents: {
		key: string;
		value: DocumentRecord;
		indexes: { updatedAt: Date };
	};
	workspace: {
		key: string;
		value: WorkspaceRecord;
	};
}

const DB_NAME = 'dotorixel';
const DB_VERSION = 1;

export class SessionStorage {
	#db: IDBPDatabase<DotorixelDB>;

	private constructor(db: IDBPDatabase<DotorixelDB>) {
		this.#db = db;
	}

	static async open(): Promise<SessionStorage> {
		const db = await openDB<DotorixelDB>(DB_NAME, DB_VERSION, {
			upgrade(db) {
				const docStore = db.createObjectStore('documents', { keyPath: 'id' });
				docStore.createIndex('updatedAt', 'updatedAt');
				db.createObjectStore('workspace', { keyPath: 'id' });
			}
		});
		return new SessionStorage(db);
	}

	async getDocument(id: string): Promise<DocumentRecord | undefined> {
		return this.#db.get('documents', id);
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
