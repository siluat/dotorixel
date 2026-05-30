<script lang="ts">
	import type { MarqueeRegion } from './canvas-model';
	import type { ViewportData } from './viewport';

	interface Props {
		marquee?: MarqueeRegion | null;
		canvasWidth: number;
		canvasHeight: number;
		viewport: ViewportData;
	}

	let { marquee, canvasWidth, canvasHeight, viewport }: Props = $props();

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
</script>

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

<style>
	.selection-overlay {
		position: absolute;
		z-index: 15;
		pointer-events: none;
		overflow: visible;
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
