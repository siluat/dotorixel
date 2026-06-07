<script lang="ts">
	import type { MarqueeRegion } from './canvas-model';
	import {
		clampSelectionDragPointerToViewport,
		computeSelectionDragTooltipPosition,
		estimateSelectionDragTooltipWidth,
		formatSelectionDragDimensions,
		type SelectionDragAid
	} from './selection-drag-aids';
	import { effectivePixelSize, type ViewportData, type ViewportSize } from './viewport';

	interface Props {
		marquee?: MarqueeRegion | null;
		floatingSelectionOffset?: { readonly dx: number; readonly dy: number } | null;
		canvasWidth: number;
		canvasHeight: number;
		viewport: ViewportData;
		viewportSize?: ViewportSize;
		dragAid?: SelectionDragAid | null;
	}

	let {
		marquee,
		floatingSelectionOffset,
		canvasWidth,
		canvasHeight,
		viewport,
		viewportSize = { width: 0, height: 0 },
		dragAid
	}: Props = $props();

	const displayMarquee = $derived.by(() => {
		if (!marquee) return null;
		return {
			x: marquee.x + (floatingSelectionOffset?.dx ?? 0),
			y: marquee.y + (floatingSelectionOffset?.dy ?? 0),
			width: marquee.width,
			height: marquee.height
		};
	});

	const projectedRect = $derived.by(() => {
		if (!displayMarquee) return null;

		const left = Math.max(0, displayMarquee.x);
		const top = Math.max(0, displayMarquee.y);
		const right = Math.min(canvasWidth, displayMarquee.x + displayMarquee.width);
		const bottom = Math.min(canvasHeight, displayMarquee.y + displayMarquee.height);
		if (left >= right || top >= bottom) return null;

		const scaledPixel = effectivePixelSize(viewport);
		return {
			left: Math.round(viewport.panX) + left * scaledPixel,
			top: Math.round(viewport.panY) + top * scaledPixel,
			width: (right - left) * scaledPixel,
			height: (bottom - top) * scaledPixel
		};
	});

	const defineMarqueeAid = $derived(
		projectedRect && marquee && dragAid?.phase === 'defineMarquee' ? dragAid : null
	);
	const dragAidPointer = $derived(
		defineMarqueeAid
			? clampSelectionDragPointerToViewport(defineMarqueeAid.pointer, viewportSize)
			: null
	);
	const marqueeDimensions = $derived(
		marquee ? formatSelectionDragDimensions(marquee.width, marquee.height) : null
	);
	const tooltipWidth = $derived(
		marqueeDimensions ? estimateSelectionDragTooltipWidth(marqueeDimensions, viewportSize) : null
	);
	const tooltipPosition = $derived(
		dragAidPointer && tooltipWidth !== null
			? computeSelectionDragTooltipPosition(dragAidPointer, viewportSize, tooltipWidth)
			: null
	);
</script>

{#if dragAidPointer}
	<svg
		class="selection-drag-guides"
		data-testid="selection-drag-guides"
		aria-hidden="true"
		style:width={`${viewportSize.width}px`}
		style:height={`${viewportSize.height}px`}
		viewBox={`0 0 ${viewportSize.width} ${viewportSize.height}`}
	>
		<line
			x1="0"
			y1={dragAidPointer.y}
			x2={dragAidPointer.x}
			y2={dragAidPointer.y}
		/>
		<line
			x1={dragAidPointer.x}
			y1={dragAidPointer.y}
			x2={viewportSize.width}
			y2={dragAidPointer.y}
		/>
		<line
			x1={dragAidPointer.x}
			y1="0"
			x2={dragAidPointer.x}
			y2={dragAidPointer.y}
		/>
		<line
			x1={dragAidPointer.x}
			y1={dragAidPointer.y}
			x2={dragAidPointer.x}
			y2={viewportSize.height}
		/>
	</svg>
{/if}

{#if projectedRect}
	<svg
		class="selection-overlay"
		data-testid="selection-overlay"
		aria-hidden="true"
		style:left={`${projectedRect.left}px`}
		style:top={`${projectedRect.top}px`}
		style:width={`${projectedRect.width}px`}
		style:height={`${projectedRect.height}px`}
		viewBox={`0 0 ${projectedRect.width} ${projectedRect.height}`}
	>
		<rect
			class="selection-wash"
			x="0.5"
			y="0.5"
			width={Math.max(0, projectedRect.width - 1)}
			height={Math.max(0, projectedRect.height - 1)}
		/>
		<rect
			class="selection-marquee"
			x="0.5"
			y="0.5"
			width={Math.max(0, projectedRect.width - 1)}
			height={Math.max(0, projectedRect.height - 1)}
		/>
	</svg>
{/if}

{#if dragAidPointer && tooltipPosition && marqueeDimensions && tooltipWidth !== null}
	<div
		class="selection-drag-tooltip"
		data-testid="selection-drag-tooltip"
		aria-hidden="true"
		style:left={`${tooltipPosition.x}px`}
		style:top={`${tooltipPosition.y}px`}
		style:width={`${tooltipWidth}px`}
	>
		{marqueeDimensions}
	</div>
{/if}

<style>
	.selection-overlay {
		position: absolute;
		z-index: 15;
		pointer-events: none;
		overflow: visible;
	}

	.selection-drag-guides {
		position: absolute;
		left: 0;
		top: 0;
		z-index: 14;
		pointer-events: none;
		overflow: visible;
	}

	.selection-drag-guides line {
		stroke: var(--ds-border-subtle);
		stroke-width: 1;
		vector-effect: non-scaling-stroke;
		shape-rendering: crispEdges;
	}

	.selection-drag-tooltip {
		position: absolute;
		z-index: 16;
		pointer-events: none;
		box-sizing: border-box;
		height: 28px;
		max-width: calc(100% - 16px);
		padding: 0 var(--ds-space-2);
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1px solid var(--ds-border);
		border-radius: var(--ds-radius-sm);
		background: var(--ds-bg-elevated);
		color: var(--ds-text-primary);
		box-shadow: var(--ds-shadow-md);
		font: 600 12px/1 var(--ds-font-body);
		white-space: nowrap;
	}

	.selection-wash,
	.selection-marquee {
		fill: none;
		vector-effect: non-scaling-stroke;
	}

	.selection-wash {
		stroke: var(--ds-bg-base);
		stroke-width: 3;
	}

	.selection-marquee {
		stroke: var(--ds-accent);
		stroke-width: 1;
		stroke-dasharray: 4 4;
		animation: marching-ants 600ms linear infinite;
	}

	@keyframes marching-ants {
		from {
			stroke-dashoffset: 0;
		}
		to {
			stroke-dashoffset: 8;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.selection-marquee {
			animation: none;
			stroke-dashoffset: 0;
		}
	}
</style>
