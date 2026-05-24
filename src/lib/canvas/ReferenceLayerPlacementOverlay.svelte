<script lang="ts">
	import type { ReferenceUnderlay } from './renderer';
	import type { ViewportData } from './viewport';
	import type { PointerType } from './canvas-interaction.svelte';

	const DESKTOP_HANDLE_SIZE = 12;
	const TOUCH_HANDLE_SIZE = 16;
	const HANDLE_HIT_SIZE = 44;

	type ReferencePlacementHandle = 'nw' | 'ne' | 'se' | 'sw';
	const placementHandles: ReferencePlacementHandle[] = ['nw', 'ne', 'se', 'sw'];

	interface Props {
		referenceUnderlay?: ReferenceUnderlay;
		viewport: ViewportData;
		isReferenceLayerActive?: boolean;
		pointerType?: PointerType;
		canMoveBody?: boolean;
		onReadOnlyPointerDown?: (event: PointerEvent) => void;
		onReadOnlyPointerMove?: (event: PointerEvent) => void;
		onReadOnlyPointerUp?: (event: PointerEvent) => void;
		onReadOnlyPointerCancel?: (event: PointerEvent) => void;
		onReadOnlyWheel?: (event: WheelEvent) => void;
	}

	let {
		referenceUnderlay,
		viewport,
		isReferenceLayerActive = false,
		pointerType = 'mouse',
		canMoveBody = false,
		onReadOnlyPointerDown,
		onReadOnlyPointerMove,
		onReadOnlyPointerUp,
		onReadOnlyPointerCancel,
		onReadOnlyWheel
	}: Props = $props();

	const projectedRect = $derived.by(() => {
		if (!referenceUnderlay || !isReferenceLayerActive) return null;
		const scaledPixel = Math.round(viewport.pixelSize * viewport.zoom);
		const panX = Math.round(viewport.panX);
		const panY = Math.round(viewport.panY);
		const { x, y, scale } = referenceUnderlay.placement;
		return {
			left: panX + x * scaledPixel,
			top: panY + y * scaledPixel,
			width: referenceUnderlay.naturalWidth * scale * scaledPixel,
			height: referenceUnderlay.naturalHeight * scale * scaledPixel
		};
	});

	const handleSize = $derived(pointerType === 'touch' ? TOUCH_HANDLE_SIZE : DESKTOP_HANDLE_SIZE);
	const handleOffset = $derived(handleSize / 2);
	const handleHitOffset = $derived((HANDLE_HIT_SIZE - handleSize) / 2);

	function blockReadOnlyPointerEvent(event: PointerEvent): void {
		event.preventDefault();
		event.stopPropagation();
	}

	function handleReadOnlyPointerEvent(
		event: PointerEvent,
		handler: ((event: PointerEvent) => void) | undefined
	): void {
		handler?.(event);
		if (!event.defaultPrevented) {
			blockReadOnlyPointerEvent(event);
		}
	}

	function blockContextMenuEvent(event: MouseEvent): void {
		event.preventDefault();
		event.stopPropagation();
	}

	function handleReadOnlyWheelEvent(event: WheelEvent): void {
		onReadOnlyWheel?.(event);
		if (!event.defaultPrevented) {
			event.preventDefault();
		}
		event.stopPropagation();
	}
</script>

{#if projectedRect}
	<!-- svelte-ignore a11y_no_static_element_interactions -- visual overlay only; PixelCanvasView blocks drawing fallthrough and forwards viewport gestures -->
	<div
		class="reference-placement-overlay"
		data-testid="reference-placement-overlay"
		data-reference-placement-overlay
		aria-hidden="true"
		style:left={`${projectedRect.left}px`}
		style:top={`${projectedRect.top}px`}
		style:width={`${projectedRect.width}px`}
		style:height={`${projectedRect.height}px`}
		style:--handle-size={`${handleSize}px`}
		style:--handle-offset={`${handleOffset}px`}
		style:--handle-hit-size={`${HANDLE_HIT_SIZE}px`}
		style:--handle-hit-offset={`${handleHitOffset}px`}
		style:pointer-events="auto"
		style:cursor={canMoveBody ? 'move' : 'auto'}
		onpointerdown={(event) => handleReadOnlyPointerEvent(event, onReadOnlyPointerDown)}
		onpointermove={(event) => handleReadOnlyPointerEvent(event, onReadOnlyPointerMove)}
		onpointerup={(event) => handleReadOnlyPointerEvent(event, onReadOnlyPointerUp)}
		onpointercancel={(event) => handleReadOnlyPointerEvent(event, onReadOnlyPointerCancel)}
		onwheel={handleReadOnlyWheelEvent}
		oncontextmenu={blockContextMenuEvent}
	>
		{#each placementHandles as handle}
			<div
				class={`reference-placement-handle handle-${handle}`}
				data-testid="reference-placement-handle"
				data-reference-placement-handle={handle}
			></div>
		{/each}
	</div>
{/if}

<style>
	.reference-placement-overlay {
		position: absolute;
		box-sizing: border-box;
		border: 1px dashed var(--ds-accent);
		box-shadow: 0 0 0 1px var(--ds-bg-base);
		z-index: 20;
		touch-action: none;
	}

	.reference-placement-handle {
		position: absolute;
		box-sizing: border-box;
		width: var(--handle-size);
		height: var(--handle-size);
		background: var(--ds-accent);
		border: 1px solid var(--ds-bg-base);
	}

	.reference-placement-handle::before {
		content: '';
		position: absolute;
		left: calc(-1 * var(--handle-hit-offset));
		top: calc(-1 * var(--handle-hit-offset));
		width: var(--handle-hit-size);
		height: var(--handle-hit-size);
	}

	.handle-nw {
		left: calc(-1 * var(--handle-offset));
		top: calc(-1 * var(--handle-offset));
	}

	.handle-ne {
		right: calc(-1 * var(--handle-offset));
		top: calc(-1 * var(--handle-offset));
	}

	.handle-nw,
	.handle-se {
		cursor: nwse-resize;
	}

	.handle-se {
		right: calc(-1 * var(--handle-offset));
		bottom: calc(-1 * var(--handle-offset));
	}

	.handle-sw {
		left: calc(-1 * var(--handle-offset));
		bottom: calc(-1 * var(--handle-offset));
	}

	.handle-ne,
	.handle-sw {
		cursor: nesw-resize;
	}
</style>
