import type { DirtyNotifier } from '$lib/canvas/editor-session/dirty-notifier';
import type { ReferenceImage } from './reference-image-types';
import type { ReferenceWindowState } from './reference-window-state-types';
import type { Placement, Viewport } from './reference-window-placement';
import {
	createPlacement,
	refitPlacement,
	commitMove,
	commitResize
} from './reference-window-placement';
import { CASCADE_OFFSET } from './reference-window-constants';
import { validateFile, type ValidationResult } from './import-validator';
import { computeThumbnailDimensions } from './thumbnail';

export type ImportError =
	| { kind: 'unsupported-format' }
	| { kind: 'too-large' }
	| { kind: 'decode-failed' };

export type ImportFileError = {
	file: File;
	error: ImportError;
};

const THUMBNAIL_LONGEST_EDGE = 256;

type ImportOneResult =
	| { ok: true; reference: ReferenceImage }
	| { ok: false; error: ImportError };

type ActiveGesture =
	| {
			kind: 'move';
			refId: string;
			docId: string;
			startX: number;
			startY: number;
	  }
	| {
			kind: 'resize';
			refId: string;
			docId: string;
			startX: number;
			startY: number;
			startWidth: number;
			startHeight: number;
	  };

export class References {
	#notifier: DirtyNotifier;
	#byDoc = $state<Record<string, ReferenceImage[]>>({});
	#windowsByDoc = $state<Record<string, ReferenceWindowState[]>>({});
	/**
	 * The Reference Window Placement Interaction in flight, if any. At most one
	 * window is being moved or resized at a time; this captures the gesture's
	 * start geometry so preview deltas resolve against it.
	 */
	#activeGesture: ActiveGesture | null = null;

	constructor(deps: {
		notifier: DirtyNotifier;
		restored?: Record<string, ReferenceImage[]>;
		restoredWindowStates?: Record<string, ReferenceWindowState[]>;
	}) {
		this.#notifier = deps.notifier;
		if (deps.restored) {
			this.#byDoc = { ...deps.restored };
		}
		if (deps.restoredWindowStates) {
			this.#windowsByDoc = { ...deps.restoredWindowStates };
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
		const existingStates = this.#windowsByDoc[docId] ?? [];
		const nextStates = existingStates.filter((s) => s.refId !== refId);
		this.#windowsByDoc = { ...this.#windowsByDoc, [docId]: nextStates };
		this.#notifier.markDirty(docId);
	}

	removeDoc(docId: string): void {
		const { [docId]: _removedRefs, ...restRefs } = this.#byDoc;
		this.#byDoc = restRefs;
		const { [docId]: _removedStates, ...restStates } = this.#windowsByDoc;
		this.#windowsByDoc = restStates;
	}

	toSnapshot(): Record<string, ReferenceImage[]> {
		const out: Record<string, ReferenceImage[]> = {};
		for (const [docId, refs] of Object.entries(this.#byDoc)) {
			out[docId] = [...refs];
		}
		return out;
	}

	windowStatesForDoc(docId: string): readonly ReferenceWindowState[] {
		return this.#windowsByDoc[docId] ?? [];
	}

	windowStateFor(refId: string, docId: string): ReferenceWindowState | undefined {
		const states = this.#windowsByDoc[docId] ?? [];
		return states.find((s) => s.refId === refId);
	}

	windowStatesSnapshot(): Record<string, ReferenceWindowState[]> {
		const out: Record<string, ReferenceWindowState[]> = {};
		for (const [docId, states] of Object.entries(this.#windowsByDoc)) {
			out[docId] = states.map((s) => ({ ...s }));
		}
		return out;
	}

	/**
	 * Create a fresh Reference Window State at `placement`, stacked on top.
	 * Internal — callers reach this through the lifecycle verbs
	 * ({@link openCentered}, {@link toggleDisplay}, {@link importDroppedBatch}).
	 */
	#createWindow(refId: string, docId: string, placement: Placement): void {
		const existing = this.#windowsByDoc[docId] ?? [];
		const nextZOrder = existing.reduce((max, s) => Math.max(max, s.zOrder), 0) + 1;
		const newState: ReferenceWindowState = {
			refId,
			visible: true,
			x: placement.x,
			y: placement.y,
			width: placement.width,
			height: placement.height,
			minimized: false,
			zOrder: nextZOrder
		};
		this.#windowsByDoc = { ...this.#windowsByDoc, [docId]: [...existing, newState] };
		this.#notifier.markDirty(docId);
	}

	/**
	 * Reveal a hidden window and raise it to the top. Internal — callers reach
	 * this through {@link openCentered} / {@link toggleDisplay}.
	 */
	#reveal(refId: string, docId: string): void {
		const existing = this.#windowsByDoc[docId] ?? [];
		const nextZOrder = existing.reduce((max, s) => Math.max(max, s.zOrder), 0) + 1;
		const next = existing.map((s) =>
			s.refId === refId ? { ...s, visible: true, zOrder: nextZOrder } : s
		);
		this.#windowsByDoc = { ...this.#windowsByDoc, [docId]: next };
		this.#notifier.markDirty(docId);
	}

	/**
	 * Raise a window above all others in its doc. Touches only the stacking
	 * order — not visibility — and is idempotent: a window already on top is
	 * left unchanged and the doc is not marked dirty.
	 */
	bringToFront(refId: string, docId: string): void {
		const existing = this.#windowsByDoc[docId] ?? [];
		const maxZ = existing.reduce((max, s) => Math.max(max, s.zOrder), 0);
		const target = existing.find((s) => s.refId === refId);
		if (!target || target.zOrder === maxZ) return;
		const next = existing.map((s) => (s.refId === refId ? { ...s, zOrder: maxZ + 1 } : s));
		this.#windowsByDoc = { ...this.#windowsByDoc, [docId]: next };
		this.#notifier.markDirty(docId);
	}

	close(refId: string, docId: string): void {
		const existing = this.#windowsByDoc[docId] ?? [];
		const next = existing.map((s) => (s.refId === refId ? { ...s, visible: false } : s));
		this.#windowsByDoc = { ...this.#windowsByDoc, [docId]: next };
		this.#notifier.markDirty(docId);
	}

	/**
	 * Cascade index for the next centered reference window in this doc.
	 *
	 * Equals the count of currently visible windows so each new window is offset
	 * by `index × CASCADE_OFFSET` from the viewport center. Drops to 0 once all
	 * visible windows are dismissed; closed-but-still-existing states do not
	 * contribute. Owned by the centered-open lifecycle path (`#displayCentered`).
	 */
	#nextCascadeIndex(docId: string): number {
		const states = this.#windowsByDoc[docId] ?? [];
		return states.filter((s) => s.visible).length;
	}

	/**
	 * Re-fit every visible reference window's placement to the supplied viewport.
	 *
	 * For each visible {@link ReferenceWindowState} in `docId`, applies
	 * {@link refitPlacement}. Writes back only when the resulting placement
	 * differs from the stored one — idempotent skips do not fire `markDirty`.
	 * Each actually-changed placement triggers a single `markDirty(docId)`.
	 */
	refitAll(docId: string, viewport: Viewport): void {
		const existing = this.#windowsByDoc[docId] ?? [];
		const next: ReferenceWindowState[] = [];
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
		this.#windowsByDoc = { ...this.#windowsByDoc, [docId]: next };
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
	 * No Reference Window State is created — gallery import is intake-only.
	 */
	async importToGallery(
		files: Iterable<File>,
		docId: string
	): Promise<{ errors: ImportFileError[] }> {
		const errors: ImportFileError[] = [];
		for (const file of files) {
			const result = await this.#importOne(file);
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
			const result = await this.#importOne(file);
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
			this.#createWindow(ref.id, docId, placement);
			index++;
		}
		return { errors };
	}

	/**
	 * Gallery-card "open" action: ensures the reference window is visible at
	 * the top z-order on return.
	 *
	 * - Existing Reference Window State (visible or hidden) → revealed and
	 *   raised to the top z-order.
	 * - No Reference Window State → creates a fresh *centered* placement,
	 *   consuming the document's cascade slot.
	 *
	 * Requires that the reference exists in the doc (callers obtain `refId`
	 * from the gallery list of refs already in the store).
	 */
	openCentered(refId: string, docId: string, viewport: Viewport): void {
		const existing = this.windowStateFor(refId, docId);
		if (existing) {
			this.#reveal(refId, docId);
			return;
		}
		this.#displayCentered(refId, docId, viewport);
	}

	/**
	 * Gallery toggle-button action: cycles a reference window's visibility.
	 *
	 * - Visible → closed (becomes hidden).
	 * - Hidden → revealed (becomes visible, raised to the top z-order).
	 * - No Reference Window State → fresh centered placement (preserves the
	 *   "first toggle opens" UX).
	 */
	toggleDisplay(refId: string, docId: string, viewport: Viewport): void {
		const existing = this.windowStateFor(refId, docId);
		if (existing && existing.visible) {
			this.close(refId, docId);
			return;
		}
		if (existing) {
			this.#reveal(refId, docId);
			return;
		}
		this.#displayCentered(refId, docId, viewport);
	}

	async #importOne(file: File): Promise<ImportOneResult> {
		const validation: ValidationResult = validateFile({ type: file.type, size: file.size });
		if (!validation.ok) {
			return { ok: false, error: { kind: validation.reason } };
		}

		let bitmap: ImageBitmap;
		try {
			bitmap = await createImageBitmap(file);
		} catch {
			return { ok: false, error: { kind: 'decode-failed' } };
		}

		const naturalWidth = bitmap.width;
		const naturalHeight = bitmap.height;
		const { w, h } = computeThumbnailDimensions(naturalWidth, naturalHeight, THUMBNAIL_LONGEST_EDGE);

		let thumbnail: Blob;
		try {
			const offscreen = new OffscreenCanvas(w, h);
			const ctx = offscreen.getContext('2d');
			if (!ctx) {
				bitmap.close();
				return { ok: false, error: { kind: 'decode-failed' } };
			}
			ctx.drawImage(bitmap, 0, 0, w, h);
			thumbnail = await offscreen.convertToBlob({ type: 'image/png' });
		} catch {
			bitmap.close();
			return { ok: false, error: { kind: 'decode-failed' } };
		}
		bitmap.close();

		return {
			ok: true,
			reference: {
				id: crypto.randomUUID(),
				filename: file.name,
				blob: file,
				thumbnail,
				mimeType: file.type,
				naturalWidth,
				naturalHeight,
				byteSize: file.size,
				addedAt: new Date()
			}
		};
	}

	#displayCentered(refId: string, docId: string, viewport: Viewport): void {
		const ref = this.forDoc(docId).find((r) => r.id === refId);
		if (!ref) return;
		const safeViewport: Viewport = {
			width: Math.max(viewport.width, 1),
			height: Math.max(viewport.height, 1)
		};
		const cascadeIndex = this.#nextCascadeIndex(docId);
		const placement = createPlacement(
			{ width: ref.naturalWidth, height: ref.naturalHeight },
			{ kind: 'centered', cascadeIndex },
			safeViewport
		);
		this.#createWindow(refId, docId, placement);
	}

	setMinimized(refId: string, docId: string, minimized: boolean): void {
		const existing = this.#windowsByDoc[docId] ?? [];
		const next = existing.map((s) => (s.refId === refId ? { ...s, minimized } : s));
		this.#windowsByDoc = { ...this.#windowsByDoc, [docId]: next };
		this.#notifier.markDirty(docId);
	}

	/**
	 * Begin a title-bar move. Captures the window's current top-left so
	 * subsequent {@link moveTo} deltas resolve against the gesture start.
	 */
	beginMove(refId: string, docId: string): void {
		const state = this.windowStateFor(refId, docId);
		if (!state) return;
		this.#activeGesture = { kind: 'move', refId, docId, startX: state.x, startY: state.y };
	}

	/**
	 * Preview a move at `(startX + dx, startY + dy)`. Unclamped — the window
	 * follows the pointer past the viewport — and does not mark the doc dirty;
	 * {@link endMove} performs the single clamp-and-persist.
	 */
	moveTo(refId: string, docId: string, dx: number, dy: number): void {
		const g = this.#activeGesture;
		if (!g || g.kind !== 'move' || g.refId !== refId || g.docId !== docId) return;
		this.#patchWindow(refId, docId, { x: g.startX + dx, y: g.startY + dy });
	}

	/**
	 * End a move. Clamps the released top-left fully inside the viewport and
	 * persists once via `markDirty` — but only when the gesture actually left
	 * the window somewhere new, so a press-release with no effective drag does
	 * not trigger a spurious auto-save. Ends the active gesture.
	 */
	endMove(refId: string, docId: string, viewport: Viewport): void {
		const g = this.#activeGesture;
		if (!g || g.kind !== 'move' || g.refId !== refId || g.docId !== docId) return;
		this.#activeGesture = null;
		const state = this.windowStateFor(refId, docId);
		if (!state) return;
		const clamped = commitMove(
			{ x: state.x, y: state.y, width: state.width, height: state.height },
			state.x,
			state.y,
			viewport
		);
		const moved = clamped.x !== g.startX || clamped.y !== g.startY;
		this.#patchWindow(refId, docId, { x: clamped.x, y: clamped.y }, { markDirty: moved });
	}

	/**
	 * Begin a corner-handle resize. Captures the window's current geometry so
	 * subsequent {@link resizeTo} deltas resolve against the gesture start.
	 */
	beginResize(refId: string, docId: string): void {
		const state = this.windowStateFor(refId, docId);
		if (!state) return;
		this.#activeGesture = {
			kind: 'resize',
			refId,
			docId,
			startX: state.x,
			startY: state.y,
			startWidth: state.width,
			startHeight: state.height
		};
	}

	/**
	 * Preview a resize. Aspect ratio is locked and the size is clamped live so
	 * the bottom-right edge cannot escape the viewport; the top-left stays
	 * anchored. Does not mark the doc dirty — {@link endResize} persists once.
	 */
	resizeTo(refId: string, docId: string, dW: number, dH: number, viewport: Viewport): void {
		const g = this.#activeGesture;
		if (!g || g.kind !== 'resize' || g.refId !== refId || g.docId !== docId) return;
		const resized = commitResize(
			{ x: g.startX, y: g.startY, width: g.startWidth, height: g.startHeight },
			dW,
			dH,
			viewport
		);
		this.#patchWindow(refId, docId, { width: resized.width, height: resized.height });
	}

	/**
	 * End a resize. The live-clamped size is already in place from
	 * {@link resizeTo}, so this only persists once — and only when the gesture
	 * actually changed the size. Ends the active gesture.
	 */
	endResize(refId: string, docId: string): void {
		const g = this.#activeGesture;
		if (!g || g.kind !== 'resize' || g.refId !== refId || g.docId !== docId) return;
		this.#activeGesture = null;
		const state = this.windowStateFor(refId, docId);
		if (!state) return;
		const changed = state.width !== g.startWidth || state.height !== g.startHeight;
		if (changed) this.#notifier.markDirty(docId);
	}

	/**
	 * Patch a window's placement fields. Marks the doc dirty only when
	 * `options.markDirty` is set — gesture previews patch silently so a
	 * mid-gesture session flush never persists an unclamped intermediate state.
	 */
	#patchWindow(
		refId: string,
		docId: string,
		patch: Partial<Pick<ReferenceWindowState, 'x' | 'y' | 'width' | 'height'>>,
		options?: { markDirty?: boolean }
	): void {
		const existing = this.#windowsByDoc[docId] ?? [];
		const next = existing.map((s) => (s.refId === refId ? { ...s, ...patch } : s));
		this.#windowsByDoc = { ...this.#windowsByDoc, [docId]: next };
		if (options?.markDirty) this.#notifier.markDirty(docId);
	}
}
