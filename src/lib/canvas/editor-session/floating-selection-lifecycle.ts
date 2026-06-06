import type {
	CanvasPoint,
	Document,
	MarqueeRegion,
	SelectionClipboardData
} from '../canvas-model';
import { activeLayerPixels, copyMarqueeRegion, restoreActiveLayerPixels } from '../wasm-backend';
import type { UndoableDocumentIntent } from './document-change-journal.svelte';

export interface FloatingSelectionOffset {
	readonly dx: number;
	readonly dy: number;
}

export type CommitFloatingSelectionIntent = Extract<
	UndoableDocumentIntent,
	{ readonly type: 'commit-floating-selection' }
>;

export type ApplyFloatingSelectionCommit = (intent: CommitFloatingSelectionIntent) => void;

interface FloatingSelection {
	readonly buffer: Uint8Array;
	readonly sourceLayerId: string;
	readonly sourceRegion: MarqueeRegion;
	readonly offset: FloatingSelectionOffset;
	readonly sourceLayerPixelsBeforeLift: Uint8Array;
	readonly snapshotMarquee: MarqueeRegion | null;
	readonly clearSourceRegionOnCommit: boolean;
}

export interface FloatingSelectionLifecycleDeps {
	readonly getDocument: () => Document;
	readonly applyCommit: ApplyFloatingSelectionCommit;
}

const DUPLICATE_FLOATING_OFFSET: FloatingSelectionOffset = { dx: 1, dy: 1 };

function blendSourceOver(
	target: Uint8Array,
	targetIndex: number,
	source: Uint8Array,
	sourceIndex: number,
	opacity = 1
): void {
	const srcA = (source[sourceIndex + 3] / 255) * Math.max(0, Math.min(1, opacity));
	if (srcA === 0) return;

	const dstA = target[targetIndex + 3] / 255;
	const outA = srcA + dstA * (1 - srcA);

	for (let channel = 0; channel < 3; channel++) {
		const src = source[sourceIndex + channel] / 255;
		const dst = target[targetIndex + channel] / 255;
		target[targetIndex + channel] = Math.round(
			((src * srcA + dst * dstA * (1 - srcA)) / outA) * 255
		);
	}
	target[targetIndex + 3] = Math.round(outA * 255);
}

function compositeFloatingSelectionIntoLayer(
	layerPixels: Uint8Array,
	canvasWidth: number,
	canvasHeight: number,
	floating: FloatingSelection
): void {
	const { sourceRegion, offset, buffer } = floating;
	const expectedLength = sourceRegion.width * sourceRegion.height * 4;
	if (buffer.length !== expectedLength) return;

	const destX = sourceRegion.x + offset.dx;
	const destY = sourceRegion.y + offset.dy;
	for (let row = 0; row < sourceRegion.height; row++) {
		const targetY = destY + row;
		if (targetY < 0 || targetY >= canvasHeight) continue;
		for (let col = 0; col < sourceRegion.width; col++) {
			const targetX = destX + col;
			if (targetX < 0 || targetX >= canvasWidth) continue;

			const sourceIndex = (row * sourceRegion.width + col) * 4;
			const targetIndex = (targetY * canvasWidth + targetX) * 4;
			blendSourceOver(layerPixels, targetIndex, buffer, sourceIndex);
		}
	}
}

function blendLayerPixelsOver(
	target: Uint8Array,
	layerPixels: Uint8Array,
	opacity: number | undefined
): void {
	for (let sourceIndex = 0; sourceIndex < layerPixels.length; sourceIndex += 4) {
		blendSourceOver(target, sourceIndex, layerPixels, sourceIndex, opacity ?? 1);
	}
}

function withDocumentActiveLayer<T>(
	document: Document,
	layerId: string,
	callback: () => T
): T {
	const previousLayerId = document.active_layer_id();
	if (previousLayerId !== layerId) {
		document.set_active_layer(layerId);
	}
	try {
		return callback();
	} finally {
		if (document.active_layer_id() !== previousLayerId) {
			document.set_active_layer(previousLayerId);
		}
	}
}

function isPointInsideMarquee(point: CanvasPoint, marquee: MarqueeRegion): boolean {
	return (
		point.x >= marquee.x &&
		point.y >= marquee.y &&
		point.x < marquee.x + marquee.width &&
		point.y < marquee.y + marquee.height
	);
}

function isValidClipboard(clipboard: SelectionClipboardData): boolean {
	return (
		clipboard.width > 0 &&
		clipboard.height > 0 &&
		clipboard.pixels.length > 0 &&
		clipboard.pixels.length === clipboard.width * clipboard.height * 4
	);
}

/**
 * Owns the transient Floating Selection lifecycle for one tab.
 *
 * The module mutates the active Document only for transient preview state:
 * lift clears the source region, cancel restores it, and preview reads
 * composite pixels with the floating buffer overlaid. Undoable persistence
 * still crosses the Document Change Journal seam through `applyCommit`, but
 * selection-local policy such as paste-before-commit, duplicate, nudge auto-lift,
 * and selection drag projection stays behind this interface.
 */
export class FloatingSelectionLifecycle {
	#deps: FloatingSelectionLifecycleDeps;
	#floating: FloatingSelection | null = null;
	#selectionDragBaselineOffset: FloatingSelectionOffset | null = null;
	#selectionDragProjectedRegion: MarqueeRegion | null = null;

	constructor(deps: FloatingSelectionLifecycleDeps) {
		this.#deps = deps;
	}

	get isActive(): boolean {
		return this.#floating !== null;
	}

	get offset(): FloatingSelectionOffset | undefined {
		return this.#floating?.offset;
	}

	liftFromMarquee(sourceRegion: MarqueeRegion): boolean {
		if (this.#floating) return false;
		const document = this.#deps.getDocument();
		const sourceLayerId = document.active_layer_id();
		const sourceLayerPixelsBeforeLift = activeLayerPixels(document).slice();
		const stateRegion = copyMarqueeRegion(sourceRegion);
		document.set_marquee(copyMarqueeRegion(sourceRegion));
		const buffer = document.lift_marquee_pixels();
		if (buffer.length === 0) return false;

		document.clear_marquee_pixels();
		this.#floating = {
			buffer,
			sourceLayerId,
			sourceRegion: stateRegion,
			offset: { dx: 0, dy: 0 },
			sourceLayerPixelsBeforeLift,
			snapshotMarquee: copyMarqueeRegion(sourceRegion),
			clearSourceRegionOnCommit: true
		};
		return true;
	}

	pasteClipboard(clipboard: SelectionClipboardData, sourceRegion: MarqueeRegion): boolean {
		if (!isValidClipboard(clipboard)) return false;
		this.commit();

		const document = this.#deps.getDocument();
		const sourceLayerId = document.active_layer_id();
		const sourceLayerPixelsBeforeLift = activeLayerPixels(document).slice();
		const marqueeBeforePaste = document.marquee();
		document.set_marquee(copyMarqueeRegion(sourceRegion));
		this.#floating = {
			buffer: clipboard.pixels.slice(),
			sourceLayerId,
			sourceRegion: copyMarqueeRegion(sourceRegion),
			offset: { dx: 0, dy: 0 },
			sourceLayerPixelsBeforeLift,
			snapshotMarquee: marqueeBeforePaste ? copyMarqueeRegion(marqueeBeforePaste) : null,
			clearSourceRegionOnCommit: false
		};
		return true;
	}

	nudgeMarquee(delta: FloatingSelectionOffset): boolean {
		if (this.#floating) return this.#moveBy(delta);

		const document = this.#deps.getDocument();
		const marquee = document.marquee();
		if (!marquee) return false;
		return this.liftFromMarquee(marquee) && this.#moveBy(delta);
	}

	moveTo(offset: FloatingSelectionOffset): boolean {
		const floating = this.#floating;
		if (!floating) return false;
		const resolved = this.#resolveSelectionDragOffset(offset);
		if (floating.offset.dx === resolved.dx && floating.offset.dy === resolved.dy) return false;
		this.#floating = { ...floating, offset: resolved };
		return true;
	}

	#moveBy(delta: FloatingSelectionOffset): boolean {
		const floating = this.#floating;
		if (!floating) return false;
		return this.moveTo({
			dx: floating.offset.dx + delta.dx,
			dy: floating.offset.dy + delta.dy
		});
	}

	duplicate(): boolean {
		const floating = this.#floating;
		if (!floating) return false;

		const duplicateBuffer = floating.buffer.slice();
		const duplicateRegion = floating.sourceRegion.translate(
			floating.offset.dx,
			floating.offset.dy
		);
		const sourceLayerId = floating.sourceLayerId;
		if (!this.commit()) return false;

		const document = this.#deps.getDocument();
		const sourceLayerPixelsBeforeDuplicate = withDocumentActiveLayer(
			document,
			sourceLayerId,
			() => activeLayerPixels(document).slice()
		);
		document.set_marquee(copyMarqueeRegion(duplicateRegion));
		this.#floating = {
			buffer: duplicateBuffer,
			sourceLayerId,
			sourceRegion: copyMarqueeRegion(duplicateRegion),
			offset: DUPLICATE_FLOATING_OFFSET,
			sourceLayerPixelsBeforeLift: sourceLayerPixelsBeforeDuplicate,
			snapshotMarquee: copyMarqueeRegion(duplicateRegion),
			clearSourceRegionOnCommit: false
		};
		return true;
	}

	cancel(): boolean {
		const floating = this.#floating;
		if (!floating) return false;
		this.endSelectionDrag();
		const document = this.#deps.getDocument();
		withDocumentActiveLayer(document, floating.sourceLayerId, () => {
			restoreActiveLayerPixels(document, floating.sourceLayerPixelsBeforeLift);
		});
		document.set_marquee(
			floating.snapshotMarquee ? copyMarqueeRegion(floating.snapshotMarquee) : null
		);
		this.#floating = null;
		return true;
	}

	#takeCommitIntent(): CommitFloatingSelectionIntent | null {
		const floating = this.#floating;
		if (!floating) return null;
		this.endSelectionDrag();
		this.#floating = null;
		return {
			type: 'commit-floating-selection',
			sourceLayerId: floating.sourceLayerId,
			sourceRegion: floating.sourceRegion,
			destOffset: floating.offset,
			buffer: floating.buffer,
			clearSourceRegion: floating.clearSourceRegionOnCommit,
			snapshotMarquee: floating.snapshotMarquee,
			sourceLayerPixelsBeforeLift: floating.sourceLayerPixelsBeforeLift
		};
	}

	commit(): boolean {
		const intent = this.#takeCommitIntent();
		if (!intent) return false;
		this.#deps.applyCommit(intent);
		return true;
	}

	clipboardSnapshot(): SelectionClipboardData | null {
		const floating = this.#floating;
		if (floating) {
			return {
				pixels: floating.buffer.slice(),
				width: floating.sourceRegion.width,
				height: floating.sourceRegion.height
			};
		}

		const document = this.#deps.getDocument();
		const marquee = document.marquee();
		if (!marquee) return null;

		const pixels = document.lift_marquee_pixels();
		if (pixels.length === 0) return null;

		return {
			pixels,
			width: marquee.width,
			height: marquee.height
		};
	}

	previewPixels(): Uint8Array {
		const document = this.#deps.getDocument();
		if (!this.#floating) return document.composite();

		const output = new Uint8Array(document.width * document.height * 4);
		for (let layerIndex = 0; layerIndex < document.layer_count(); layerIndex++) {
			if (!document.layer_visible_at(layerIndex)) continue;
			const layerPixels = document.layer_pixels_at(layerIndex);
			if (!layerPixels) continue;

			const previewPixels =
				document.layer_id_at(layerIndex) === this.#floating.sourceLayerId
					? layerPixels.slice()
					: layerPixels;
			if (previewPixels !== layerPixels) {
				compositeFloatingSelectionIntoLayer(
					previewPixels,
					document.width,
					document.height,
					this.#floating
				);
			}
			blendLayerPixelsOver(output, previewPixels, document.layer_opacity_at(layerIndex));
		}
		return output;
	}

	pixelLayerSnapshotPixels(layerId: string, currentPixels: Uint8Array): Uint8Array {
		return this.#floating?.sourceLayerId === layerId
			? this.#floating.sourceLayerPixelsBeforeLift
			: currentPixels;
	}

	#projectMarqueeForSelectionDrag(): MarqueeRegion | null | undefined {
		const floating = this.#floating;
		if (!floating) return undefined;

		const document = this.#deps.getDocument();
		const originalMarquee = document.marquee();
		const projectedRegion = floating.sourceRegion.translate(
			floating.offset.dx,
			floating.offset.dy
		);
		document.set_marquee(copyMarqueeRegion(projectedRegion));
		this.#selectionDragBaselineOffset = floating.offset;
		this.#selectionDragProjectedRegion = copyMarqueeRegion(projectedRegion);
		return originalMarquee ? copyMarqueeRegion(originalMarquee) : null;
	}

	#restoreMarqueeAfterSelectionDragProjection(
		restoreMarquee: MarqueeRegion | null | undefined
	): void {
		if (restoreMarquee === undefined) return;
		this.#deps
			.getDocument()
			.set_marquee(restoreMarquee ? copyMarqueeRegion(restoreMarquee) : null);
	}

	withDrawStartPolicy<T>(isSelectionTool: boolean, run: () => T): T {
		this.endSelectionDrag();
		const restoreMarquee = isSelectionTool ? this.#projectMarqueeForSelectionDrag() : undefined;
		if (restoreMarquee === undefined) {
			this.commit();
			return run();
		}

		try {
			return run();
		} finally {
			this.#restoreMarqueeAfterSelectionDragProjection(restoreMarquee);
		}
	}

	commitIfSelectionDragStartsOutside(current: CanvasPoint, previous: CanvasPoint | null): boolean {
		const projectedRegion = this.#selectionDragProjectedRegion;
		if (!projectedRegion || previous !== null) return false;
		if (isPointInsideMarquee(current, projectedRegion)) return false;

		this.endSelectionDrag();
		return this.commit();
	}

	endSelectionDrag(): void {
		this.#selectionDragBaselineOffset = null;
		this.#selectionDragProjectedRegion = null;
	}

	#resolveSelectionDragOffset(offset: FloatingSelectionOffset): FloatingSelectionOffset {
		const baseline = this.#selectionDragBaselineOffset;
		if (!baseline || !this.#floating) return offset;
		return {
			dx: baseline.dx + offset.dx,
			dy: baseline.dy + offset.dy
		};
	}
}
