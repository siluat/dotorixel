import type { SessionPersistence } from './session-persistence';
import type { Workspace } from '$lib/canvas/workspace.svelte';

export class AutoSave {
	#persistence: SessionPersistence;
	#workspace: Workspace;
	#debounceMs: number;
	#dirty = false;
	#dirtyDocIds = new Set<string>();
	#timer: ReturnType<typeof setTimeout> | null = null;
	#pendingSave: Promise<void> | null = null;

	constructor(persistence: SessionPersistence, workspace: Workspace, debounceMs = 3000) {
		this.#persistence = persistence;
		this.#workspace = workspace;
		this.#debounceMs = debounceMs;
	}

	markDirty(documentId?: string): void {
		this.#dirty = true;
		if (documentId) {
			this.#dirtyDocIds.add(documentId);
		}
		if (this.#timer !== null) {
			clearTimeout(this.#timer);
		}
		this.#timer = setTimeout(() => {
			this.#timer = null;
			this.#pendingSave = this.#save().finally(() => {
				this.#pendingSave = null;
			});
		}, this.#debounceMs);
	}

	notifyTabRemoved(documentId: string): void {
		this.markDirty();
		this.#dirtyDocIds.delete(documentId);
	}

	async flush(): Promise<void> {
		if (this.#timer !== null) {
			clearTimeout(this.#timer);
			this.#timer = null;
		}
		if (this.#pendingSave) {
			await this.#pendingSave;
		}
		await this.#save();
	}

	async #save(): Promise<void> {
		if (!this.#dirty) return;
		this.#dirty = false;
		const dirtyDocIds = this.#dirtyDocIds.size > 0 ? new Set(this.#dirtyDocIds) : undefined;
		this.#dirtyDocIds.clear();
		await this.#persistence.save(this.#workspace, dirtyDocIds);
	}

	dispose(): void {
		if (this.#timer !== null) {
			clearTimeout(this.#timer);
			this.#timer = null;
		}
	}
}
