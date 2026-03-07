<script lang="ts">
	import type { PixelCanvas } from './canvas.ts';
	import type { ViewportConfig } from './renderer.ts';
	import { getDisplaySize, renderPixelCanvas } from './renderer.ts';

	interface Props {
		pixelCanvas: PixelCanvas;
		viewport: ViewportConfig;
	}

	let { pixelCanvas, viewport }: Props = $props();

	let canvasEl: HTMLCanvasElement | undefined = $state();

	$effect(() => {
		if (!canvasEl) return;
		const ctx = canvasEl.getContext('2d');
		if (!ctx) return;

		const displaySize = getDisplaySize(pixelCanvas, viewport);
		canvasEl.width = displaySize.width;
		canvasEl.height = displaySize.height;

		renderPixelCanvas(ctx, pixelCanvas, viewport);
	});
</script>

<canvas bind:this={canvasEl} class="pixel-canvas"></canvas>

<style>
	.pixel-canvas {
		display: block;
		image-rendering: pixelated;
	}
</style>
