import type { DirtyNotifier } from '$lib/canvas/editor-session/dirty-notifier';
import type { ReferenceImage } from './reference-image-types';
import type { DisplayState } from './display-state-types';
import type { Placement, Viewport } from './reference-window-placement';
import { createPlacement, refitPlacement } from './reference-window-placement';
import { CASCADE_OFFSET } from './reference-window-constants';
import { importReferenceImage, type ImportError } from './import-reference-image';

export type ImportFileError = {
	file: File;
	error: ImportError;
};

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

	/**
	 * Re-fit every visible reference window's placement to the supplied viewport.
	 *
	 * For each visible {@link DisplayState} in `docId`, applies
	 * {@link refitPlacement}. Writes back only when the resulting placement
	 * differs from the stored one — idempotent skips do not fire `markDirty`.
	 * Each actually-changed placement triggers a single `markDirty(docId)`.
	 */
	refitAll(docId: string, viewport: Viewport): void {
		const existing = this.#displayByDoc[docId] ?? [];
		const next: DisplayState[] = [];
		let changedCount = 0;
		for (const s of existing) {
			if (!s.visible) {
				next.push(s);
				continue;
			}
			const refit = refitPlacement(
				{ x: s.x, y: s.y, width: s.width, height: s.height },
				viewport
			);
			if (
				refit.x === s.x &&
				refit.y === s.y &&
				refit.width === s.width &&
				refit.height === s.height
			) {
				next.push(s);
				continue;
			}
			next.push({ ...s, x: refit.x, y: refit.y, width: refit.width, height: refit.height });
			changedCount++;
		}
		if (changedCount === 0) return;
		this.#displayByDoc = { ...this.#displayByDoc, [docId]: next };
		for (let i = 0; i < changedCount; i++) {
			this.#notifier.markDirty(docId);
		}
	}

	/**
	 * Validate, decode, thumbnail, and add each file to the doc's gallery
	 * sequentially in input order. Imports that fail validation or decoding
	 * are returned as typed errors paired with the source `File`; callers
	 * format localized messages from those.
	 *
	 * No display state is created — gallery import is intake-only.
	 */
	async importToGallery(
		files: Iterable<File>,
		docId: string
	): Promise<{ errors: ImportFileError[] }> {
		const errors: ImportFileError[] = [];
		for (const file of files) {
			const result = await importReferenceImage(file);
			if (result.ok) {
				this.add(result.reference, docId);
			} else {
				errors.push({ file, error: result.error });
			}
		}
		return { errors };
	}

	/**
	 * Drop-batch intake: validate/decode/thumbnail each file, add it, and
	 * place it on the canvas with an *at-point* placement anchored at
	 * `(anchor.x + index × CASCADE_OFFSET, anchor.y + index × CASCADE_OFFSET)`.
	 *
	 * The intra-batch cascade is local to this drop — the document's
	 * centered-cascade slot (`nextCascadeIndex`) is not advanced. Failed
	 * imports are skipped and surfaced as errors paired with the source `File`.
	 */
	async importDroppedBatch(
		files: Iterable<File>,
		docId: string,
		anchor: { x: number; y: number },
		viewport: Viewport
	): Promise<{ errors: ImportFileError[] }> {
		const safeViewport: Viewport = {
			width: Math.max(viewport.width, 1),
			height: Math.max(viewport.height, 1)
		};
		const errors: ImportFileError[] = [];
		let index = 0;
		for (const file of files) {
			const result = await importReferenceImage(file);
			if (!result.ok) {
				errors.push({ file, error: result.error });
				continue;
			}
			const ref = result.reference;
			this.add(ref, docId);
			const placement = createPlacement(
				{ width: ref.naturalWidth, height: ref.naturalHeight },
				{
					kind: 'at-point',
					x: anchor.x + index * CASCADE_OFFSET,
					y: anchor.y + index * CASCADE_OFFSET
				},
				safeViewport
			);
			this.display(ref.id, docId, placement);
			index++;
		}
		return { errors };
	}

	/**
	 * Gallery-card "open" action: ensures the reference window is visible at
	 * the top z-order on return.
	 *
	 * - Existing display state (visible or hidden) → raises z-order via `show`.
	 * - No display state → creates a fresh *centered* placement, consuming
	 *   the document's cascade slot.
	 *
	 * Requires that the reference exists in the doc (callers obtain `refId`
	 * from the gallery list of refs already in the store).
	 */
	openCentered(refId: string, docId: string, viewport: Viewport): void {
		const existing = this.displayStateFor(refId, docId);
		if (existing) {
			this.show(refId, docId);
			return;
		}
		this.#displayCentered(refId, docId, viewport);
	}

	/**
	 * Gallery toggle-button action: cycles a reference window's visibility.
	 *
	 * - Visible → close (becomes hidden).
	 * - Hidden → show (becomes visible, raises z-order).
	 * - No display state → fresh centered placement (preserves the "first
	 *   toggle opens" UX).
	 */
	toggleDisplay(refId: string, docId: string, viewport: Viewport): void {
		const existing = this.displayStateFor(refId, docId);
		if (existing && existing.visible) {
			this.close(refId, docId);
			return;
		}
		if (existing) {
			this.show(refId, docId);
			return;
		}
		this.#displayCentered(refId, docId, viewport);
	}

	#displayCentered(refId: string, docId: string, viewport: Viewport): void {
		const ref = this.forDoc(docId).find((r) => r.id === refId);
		if (!ref) return;
		const safeViewport: Viewport = {
			width: Math.max(viewport.width, 1),
			height: Math.max(viewport.height, 1)
		};
		const cascadeIndex = this.nextCascadeIndex(docId);
		const placement = createPlacement(
			{ width: ref.naturalWidth, height: ref.naturalHeight },
			{ kind: 'centered', cascadeIndex },
			safeViewport
		);
		this.display(refId, docId, placement);
	}

	setMinimized(refId: string, docId: string, minimized: boolean): void {
		const existing = this.#displayByDoc[docId] ?? [];
		const next = existing.map((s) => (s.refId === refId ? { ...s, minimized } : s));
		this.#displayByDoc = { ...this.#displayByDoc, [docId]: next };
		this.#notifier.markDirty(docId);
	}
}
