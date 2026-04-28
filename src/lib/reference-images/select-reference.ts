import { computeInitialPlacement } from './compute-initial-placement';
import type { ReferenceImagesStore } from './reference-images-store.svelte';
import type { ReferenceImage } from './reference-image-types';

interface DisplayArgs {
	store: ReferenceImagesStore;
	docId: string;
	ref: ReferenceImage;
	viewport: { width: number; height: number };
}

interface SelectArgs extends DisplayArgs {
	onClose: () => void;
}

/**
 * Place a reference window on the doc's canvas using the doc's current
 * cascade slot (`store.nextCascadeIndex`) and a centered, viewport-fit size.
 *
 * Viewport dimensions are clamped to at least 1px so degenerate inputs don't
 * produce non-finite placements.
 */
export function displayReference({ store, docId, ref, viewport }: DisplayArgs): void {
	const cascadeIndex = store.nextCascadeIndex(docId);
	const placement = computeInitialPlacement({
		naturalWidth: ref.naturalWidth,
		naturalHeight: ref.naturalHeight,
		viewportWidth: Math.max(viewport.width, 1),
		viewportHeight: Math.max(viewport.height, 1),
		cascadeIndex
	});
	store.display(ref.id, docId, placement);
}

/**
 * Gallery-card selection action. Always closes the modal after acting:
 * - existing display state (visible or hidden) → `store.show()` raises and re-displays
 * - no display state yet → `displayReference()` creates a fresh placement
 */
export function selectReference({ store, docId, ref, viewport, onClose }: SelectArgs): void {
	const existing = store.displayStateFor(ref.id, docId);
	if (existing) {
		store.show(ref.id, docId);
	} else {
		displayReference({ store, docId, ref, viewport });
	}
	onClose();
}
