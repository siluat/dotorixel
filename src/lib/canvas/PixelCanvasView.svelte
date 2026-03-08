<script lang="ts">
	import type { PixelCanvas, CanvasCoords } from './canvas.ts';
	import type { ViewportConfig } from './viewport.ts';
	import { getDisplaySize, screenToCanvas } from './viewport.ts';
	import { renderPixelCanvas } from './renderer.ts';

	interface Props {
		pixelCanvas: PixelCanvas;
		viewport: ViewportConfig;
		renderVersion?: number;
		onDraw?: (current: CanvasCoords, previous: CanvasCoords | null) => void;
		toolCursor?: string;
	}

	let {
		pixelCanvas,
		viewport,
		renderVersion = 0,
		onDraw,
		toolCursor = 'crosshair'
	}: Props = $props();

	let canvasEl: HTMLCanvasElement | undefined = $state();
	let isDrawing = $state(false);
	let lastPixelX = $state(-1);
	let lastPixelY = $state(-1);

	$effect(() => {
		if (!canvasEl) return;
		const ctx = canvasEl.getContext('2d');
		if (!ctx) return;

		// Read renderVersion to subscribe to mutation-triggered re-renders
		void renderVersion;

		const displaySize = getDisplaySize(pixelCanvas, viewport);
		canvasEl.width = displaySize.width;
		canvasEl.height = displaySize.height;

		renderPixelCanvas(ctx, pixelCanvas, viewport);
	});

	function getCanvasCoords(event: MouseEvent): CanvasCoords {
		const rect = canvasEl!.getBoundingClientRect();
		return screenToCanvas(event.clientX - rect.left, event.clientY - rect.top, viewport);
	}

	function drawAt(coords: CanvasCoords): void {
		if (coords.x === lastPixelX && coords.y === lastPixelY) return;
		const previous =
			lastPixelX !== -1 ? { x: lastPixelX, y: lastPixelY } : null;
		lastPixelX = coords.x;
		lastPixelY = coords.y;
		onDraw?.(coords, previous);
	}

	function handleMouseDown(event: MouseEvent): void {
		if (event.button !== 0) return;
		isDrawing = true;
		lastPixelX = -1;
		lastPixelY = -1;
		drawAt(getCanvasCoords(event));
	}

	function handleMouseMove(event: MouseEvent): void {
		if (!isDrawing) return;
		drawAt(getCanvasCoords(event));
	}

	function handleMouseUp(): void {
		isDrawing = false;
	}

	function handleMouseLeave(event: MouseEvent): void {
		if (isDrawing) {
			drawAt(getCanvasCoords(event));
		}
		isDrawing = false;
	}
</script>

<svelte:window onmouseup={handleMouseUp} />

<canvas
	bind:this={canvasEl}
	class="pixel-canvas"
	style:cursor={toolCursor}
	onmousedown={handleMouseDown}
	onmousemove={handleMouseMove}
	onmouseleave={handleMouseLeave}
></canvas>

<style>
	.pixel-canvas {
		display: block;
		image-rendering: pixelated;
	}
</style>
