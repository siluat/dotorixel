<script lang="ts">
	import { createCanvas } from '$lib/canvas/canvas';
	import { createDefaultViewport } from '$lib/canvas/renderer';
	import PixelCanvasView from '$lib/canvas/PixelCanvasView.svelte';

	const pixelCanvas = createCanvas(16);
	const viewport = createDefaultViewport(16);
</script>

<main>
	<h1>DOTORIXEL</h1>
	<div class="canvas-container">
		<PixelCanvasView {pixelCanvas} {viewport} />
	</div>
</main>

<style>
	main {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 2rem;
	}

	h1 {
		margin-bottom: 1.5rem;
	}

	.canvas-container {
		border: 1px solid #999;
	}
</style>
