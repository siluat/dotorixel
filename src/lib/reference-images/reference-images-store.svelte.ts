import type { DirtyNotifier } from '$lib/canvas/editor-session/dirty-notifier';
import type { ReferenceImage } from './reference-image-types';
import type { DisplayState } from './display-state-types';
import type { Placement } from './compute-initial-placement';

export class ReferenceImagesStore {
	#notifier: DirtyNotifier;
	#byDoc = $state<Record<string, ReferenceImage[]>>({});
	#displayByDoc = $state<Record<string, DisplayState[]>>({});

	constructor(deps: {
		notifier: DirtyNotifier;
		restored?: Record<string, ReferenceImage[]>;
		restoredDisplayStates?: Record<string, DisplayState[]>;
	}) {
		this.#notifier = deps.notifier;
		if (deps.restored) {
			this.#byDoc = { ...deps.restored };
		}
		if (deps.restoredDisplayStates) {
			this.#displayByDoc = { ...deps.restoredDisplayStates };
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
		const existingStates = this.#displayByDoc[docId] ?? [];
		const nextStates = existingStates.filter((s) => s.refId !== refId);
		this.#displayByDoc = { ...this.#displayByDoc, [docId]: nextStates };
		this.#notifier.markDirty(docId);
	}

	removeDoc(docId: string): void {
		const { [docId]: _removedRefs, ...restRefs } = this.#byDoc;
		this.#byDoc = restRefs;
		const { [docId]: _removedStates, ...restStates } = this.#displayByDoc;
		this.#displayByDoc = restStates;
	}

	toSnapshot(): Record<string, ReferenceImage[]> {
		const out: Record<string, ReferenceImage[]> = {};
		for (const [docId, refs] of Object.entries(this.#byDoc)) {
			out[docId] = [...refs];
		}
		return out;
	}

	displayStatesForDoc(docId: string): readonly DisplayState[] {
		return this.#displayByDoc[docId] ?? [];
	}

	displayStateFor(refId: string, docId: string): DisplayState | undefined {
		const states = this.#displayByDoc[docId] ?? [];
		return states.find((s) => s.refId === refId);
	}

	displayStatesSnapshot(): Record<string, DisplayState[]> {
		const out: Record<string, DisplayState[]> = {};
		for (const [docId, states] of Object.entries(this.#displayByDoc)) {
			out[docId] = states.map((s) => ({ ...s }));
		}
		return out;
	}

	display(refId: string, docId: string, placement: Placement): void {
		const existing = this.#displayByDoc[docId] ?? [];
		const nextZOrder = existing.reduce((max, s) => Math.max(max, s.zOrder), 0) + 1;
		const newState: DisplayState = {
			refId,
			visible: true,
			x: placement.x,
			y: placement.y,
			width: placement.width,
			height: placement.height,
			minimized: false,
			zOrder: nextZOrder
		};
		this.#displayByDoc = { ...this.#displayByDoc, [docId]: [...existing, newState] };
		this.#notifier.markDirty(docId);
	}

	show(refId: string, docId: string): void {
		const existing = this.#displayByDoc[docId] ?? [];
		const nextZOrder = existing.reduce((max, s) => Math.max(max, s.zOrder), 0) + 1;
		const next = existing.map((s) =>
			s.refId === refId ? { ...s, visible: true, zOrder: nextZOrder } : s
		);
		this.#displayByDoc = { ...this.#displayByDoc, [docId]: next };
		this.#notifier.markDirty(docId);
	}

	close(refId: string, docId: string): void {
		const existing = this.#displayByDoc[docId] ?? [];
		const next = existing.map((s) => (s.refId === refId ? { ...s, visible: false } : s));
		this.#displayByDoc = { ...this.#displayByDoc, [docId]: next };
		this.#notifier.markDirty(docId);
	}

	setDisplayPosition(refId: string, docId: string, x: number, y: number): void {
		const existing = this.#displayByDoc[docId] ?? [];
		const next = existing.map((s) => (s.refId === refId ? { ...s, x, y } : s));
		this.#displayByDoc = { ...this.#displayByDoc, [docId]: next };
		this.#notifier.markDirty(docId);
	}

	setDisplaySize(refId: string, docId: string, width: number, height: number): void {
		const existing = this.#displayByDoc[docId] ?? [];
		const next = existing.map((s) => (s.refId === refId ? { ...s, width, height } : s));
		this.#displayByDoc = { ...this.#displayByDoc, [docId]: next };
		this.#notifier.markDirty(docId);
	}

	/**
	 * Cascade index for the next reference window to be displayed in this doc.
	 *
	 * Equals the count of currently visible windows so each new window is offset
	 * by `index × 24px` from the viewport center. Resets to 0 once all visible
	 * windows are dismissed; closed-but-still-existing states do not contribute.
	 */
	nextCascadeIndex(docId: string): number {
		const states = this.#displayByDoc[docId] ?? [];
		return states.filter((s) => s.visible).length;
	}

	setMinimized(refId: string, docId: string, minimized: boolean): void {
		const existing = this.#displayByDoc[docId] ?? [];
		const next = existing.map((s) => (s.refId === refId ? { ...s, minimized } : s));
		this.#displayByDoc = { ...this.#displayByDoc, [docId]: next };
		this.#notifier.markDirty(docId);
	}
}
