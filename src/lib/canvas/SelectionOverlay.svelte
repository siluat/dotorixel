<script lang="ts">
	import type { MarqueeRegion } from './canvas-model';
	import {
		computeSelectionDragTooltipPosition,
		type SelectionDragAid
	} from './selection-drag-aids';
	import type { ViewportData, ViewportSize } from './viewport';

	interface Props {
		marquee?: MarqueeRegion | null;
		canvasWidth: number;
		canvasHeight: number;
		viewport: ViewportData;
		viewportSize?: ViewportSize;
		dragAid?: SelectionDragAid | null;
	}

	let {
		marquee,
		canvasWidth,
		canvasHeight,
		viewport,
		viewportSize = { width: 0, height: 0 },
		dragAid
	}: Props = $props();

	const projectedRect = $derived.by(() => {
		if (!marquee) return null;

		const left = Math.max(0, marquee.x);
		const top = Math.max(0, marquee.y);
		const right = Math.min(canvasWidth, marquee.x + marquee.width);
		const bottom = Math.min(canvasHeight, marquee.y + marquee.height);
		if (left >= right || top >= bottom) return null;

		const scaledPixel = Math.round(viewport.pixelSize * viewport.zoom);
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
	const tooltipPosition = $derived(
		defineMarqueeAid
			? computeSelectionDragTooltipPosition(defineMarqueeAid.pointer, viewportSize)
			: null
	);
</script>

{#if defineMarqueeAid}
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
			y1={defineMarqueeAid.pointer.y}
			x2={defineMarqueeAid.pointer.x}
			y2={defineMarqueeAid.pointer.y}
		/>
		<line
			x1={defineMarqueeAid.pointer.x}
			y1={defineMarqueeAid.pointer.y}
			x2={viewportSize.width}
			y2={defineMarqueeAid.pointer.y}
		/>
		<line
			x1={defineMarqueeAid.pointer.x}
			y1="0"
			x2={defineMarqueeAid.pointer.x}
			y2={defineMarqueeAid.pointer.y}
		/>
		<line
			x1={defineMarqueeAid.pointer.x}
			y1={defineMarqueeAid.pointer.y}
			x2={defineMarqueeAid.pointer.x}
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

{#if defineMarqueeAid && tooltipPosition && marquee}
	<div
		class="selection-drag-tooltip"
		data-testid="selection-drag-tooltip"
		aria-hidden="true"
		style:left={`${tooltipPosition.x}px`}
		style:top={`${tooltipPosition.y}px`}
	>
		{marquee.width}×{marquee.height}
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
		width: 64px;
		height: 28px;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1px solid var(--ds-border);
		border-radius: var(--ds-radius-sm);
		background: var(--ds-bg-elevated);
		color: var(--ds-text-primary);
		box-shadow: var(--ds-shadow-md);
		font: 600 12px/1 var(--ds-font-body);
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
