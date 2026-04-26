import type { DirtyNotifier } from '$lib/canvas/editor-session/dirty-notifier';
import type { ReferenceImage } from './reference-image-types';

export class ReferenceImagesStore {
	#notifier: DirtyNotifier;
	#byDoc = $state<Record<string, ReferenceImage[]>>({});

	constructor(deps: {
		notifier: DirtyNotifier;
		restored?: Record<string, ReferenceImage[]>;
	}) {
		this.#notifier = deps.notifier;
		if (deps.restored) {
			this.#byDoc = { ...deps.restored };
		}
	}

	forDoc(docId: string): readonly ReferenceImage[] {
		return this.#byDoc[docId] ?? [];
	}

	add(ref: ReferenceImage, docId: string): void {
		const existing = this.#byDoc[docId] ?? [];
		this.#byDoc = { ...this.#byDoc, [docId]: [...existing, ref] };
		this.#notifier.markDirty(docId);
	}

	delete(refId: string, docId: string): void {
		const existing = this.#byDoc[docId] ?? [];
		const next = existing.filter((r) => r.id !== refId);
		this.#byDoc = { ...this.#byDoc, [docId]: next };
		this.#notifier.markDirty(docId);
	}

	removeDoc(docId: string): void {
		const { [docId]: _removed, ...rest } = this.#byDoc;
		this.#byDoc = rest;
	}

	toSnapshot(): Record<string, ReferenceImage[]> {
		const out: Record<string, ReferenceImage[]> = {};
		for (const [docId, refs] of Object.entries(this.#byDoc)) {
			out[docId] = [...refs];
		}
		return out;
	}
}
