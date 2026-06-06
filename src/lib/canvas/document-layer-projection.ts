import type { Document } from './canvas-model';
import type { ReferenceLayerUnderlay } from './reference-layer-underlay';

export type DocumentLayerKind = 'pixel' | 'reference';

export interface DocumentLayerRead {
	readonly id: string;
	readonly name: string;
	readonly visible: boolean;
	readonly opacity: number;
	readonly kind: DocumentLayerKind;
	/** Bottom-to-top stack index from the Rust core Document. */
	readonly stackIndex: number;
	/** Top-to-bottom visual index used by the timeline panel. */
	readonly panelIndex: number;
}

export interface DocumentLayerProjectionRead {
	readonly layersInStackOrder: readonly DocumentLayerRead[];
	readonly layersInPanelOrder: readonly DocumentLayerRead[];
	readonly layerById: ReadonlyMap<string, DocumentLayerRead>;
	readonly stackIndexById: ReadonlyMap<string, number>;
	readonly activeLayer?: DocumentLayerRead;
	readonly activeLayerKind?: DocumentLayerKind;
	readonly referenceLayer?: DocumentLayerRead;
	readonly referenceLayerUnderlay?: ReferenceLayerUnderlay;
}

type StackLayerRead = Omit<DocumentLayerRead, 'panelIndex'>;

interface CachedReferenceLayerSource {
	readonly document: Document;
	readonly layerId: string;
	readonly sourceFingerprint: string;
	readonly naturalWidth: number;
	readonly naturalHeight: number;
	readonly sourceKey: string;
	readonly sourceRgba: Uint8Array;
}

/**
 * Per-tab projection of a Document's Layer stack into shell-facing read models.
 * The projection also owns the Reference Layer source RGBA cache so render,
 * sampling, and UI consumers share one WASM-copy boundary.
 */
export class DocumentLayerProjection {
	#source?: CachedReferenceLayerSource;

	#clearReferenceSource(): undefined {
		this.#source = undefined;
		return undefined;
	}

	read(document: Document): DocumentLayerProjectionRead {
		const activeLayerId = document.active_layer_id();
		const stackLayers: StackLayerRead[] = [];
		let referenceStackIndex: number | undefined;
		let referenceLayerUnderlay: ReferenceLayerUnderlay | undefined;

		for (let stackIndex = 0; stackIndex < document.layer_count(); stackIndex++) {
			const id = document.layer_id_at(stackIndex);
			const name = document.layer_name_at(stackIndex);
			const visible = document.layer_visible_at(stackIndex);
			const opacity = document.layer_opacity_at(stackIndex);
			const kind = normalizeLayerKind(document.layer_kind_at(stackIndex));
			if (
				id === undefined ||
				name === undefined ||
				visible === undefined ||
				opacity === undefined ||
				kind === undefined
			) {
				continue;
			}

			stackLayers.push({
				id,
				name,
				visible,
				opacity,
				kind,
				stackIndex
			});

			if (kind === 'reference' && referenceStackIndex === undefined) {
				referenceStackIndex = stackIndex;
				referenceLayerUnderlay = this.#projectReferenceLayerUnderlay(
					document,
					stackIndex,
					id,
					visible,
					opacity
				);
			}
		}

		if (referenceStackIndex === undefined) {
			referenceLayerUnderlay = this.#clearReferenceSource();
		}

		const layerCount = stackLayers.length;
		const layersInStackOrder = stackLayers.map((layer, index) => ({
			...layer,
			panelIndex: layerCount - 1 - index
		}));
		const layersInPanelOrder = layersInStackOrder.slice().reverse();
		const layerById = new Map(layersInStackOrder.map((layer) => [layer.id, layer]));
		const stackIndexById = new Map(layersInStackOrder.map((layer) => [layer.id, layer.stackIndex]));
		const activeLayer = layerById.get(activeLayerId);

		return {
			layersInStackOrder,
			layersInPanelOrder,
			layerById,
			stackIndexById,
			activeLayer,
			activeLayerKind: activeLayer?.kind,
			referenceLayer:
				referenceStackIndex === undefined
					? undefined
					: layersInStackOrder.find((layer) => layer.stackIndex === referenceStackIndex),
			referenceLayerUnderlay
		};
	}

	#projectReferenceLayerUnderlay(
		document: Document,
		stackIndex: number,
		layerId: string,
		visible: boolean,
		opacity: number
	): ReferenceLayerUnderlay | undefined {
		if (!visible) return this.#clearReferenceSource();

		const sourceFingerprint = document.layer_source_fingerprint_at(stackIndex);
		const dimensions = document.layer_source_dimensions_at(stackIndex);
		const placement = document.layer_placement_at(stackIndex);
		if (!sourceFingerprint || !dimensions || !placement) {
			return this.#clearReferenceSource();
		}

		const naturalWidth = dimensions[0];
		const naturalHeight = dimensions[1];
		let source =
			this.#source?.document === document &&
			this.#source.layerId === layerId &&
			this.#source.sourceFingerprint === sourceFingerprint &&
			this.#source.naturalWidth === naturalWidth &&
			this.#source.naturalHeight === naturalHeight
				? this.#source
				: undefined;

		if (!source) {
			const sourceRgba = document.layer_source_pixels_at(stackIndex);
			if (!sourceRgba) return this.#clearReferenceSource();
			source = {
				document,
				layerId,
				sourceFingerprint,
				naturalWidth,
				naturalHeight,
				sourceKey: `${layerId}:${naturalWidth}x${naturalHeight}:${sourceFingerprint}`,
				sourceRgba
			};
			this.#source = source;
		}

		return {
			sourceKey: source.sourceKey,
			sourceRgba: source.sourceRgba,
			naturalWidth,
			naturalHeight,
			placement: {
				x: placement.x,
				y: placement.y,
				scale: placement.scale
			},
			opacity
		};
	}
}

function normalizeLayerKind(kind: string | undefined): DocumentLayerKind | undefined {
	if (kind === 'reference') return 'reference';
	if (kind === 'pixel') return 'pixel';
	return undefined;
}
