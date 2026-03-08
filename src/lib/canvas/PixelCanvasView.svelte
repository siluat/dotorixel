<script lang="ts">
	import type { PixelCanvas, CanvasCoords } from './canvas.ts';
	import type { ViewportConfig, ViewportSize } from './viewport.ts';
	import { screenToCanvas, zoomAtPoint, pan, nextZoomLevel, prevZoomLevel } from './viewport.ts';
	import { renderPixelCanvas } from './renderer.ts';

	interface Props {
		pixelCanvas: PixelCanvas;
		viewport: ViewportConfig;
		viewportSize?: ViewportSize;
		renderVersion?: number;
		onDraw?: (current: CanvasCoords, previous: CanvasCoords | null) => void;
		onViewportChange?: (viewport: ViewportConfig) => void;
		toolCursor?: string;
	}

	let {
		pixelCanvas,
		viewport,
		viewportSize = { width: 512, height: 512 },
		renderVersion = 0,
		onDraw,
		onViewportChange,
		toolCursor = 'crosshair'
	}: Props = $props();

	let canvasEl: HTMLCanvasElement | undefined = $state();
	let isDrawing = $state(false);
	let isPanning = $state(false);
	let isSpaceHeld = $state(false);
	let panStartX = $state(0);
	let panStartY = $state(0);
	let lastPixelX = $state(-1);
	let lastPixelY = $state(-1);

	$effect(() => {
		if (!canvasEl) return;
		const ctx = canvasEl.getContext('2d');
		if (!ctx) return;

		void renderVersion;

		canvasEl.width = viewportSize.width;
		canvasEl.height = viewportSize.height;

		renderPixelCanvas(ctx, pixelCanvas, viewport, viewportSize);
	});

	// Register wheel listener with { passive: false } to allow preventDefault
	$effect(() => {
		if (!canvasEl) return;
		const handler = (event: WheelEvent) => {
			if (event.deltaY === 0) return;
			event.preventDefault();
			const rect = canvasEl!.getBoundingClientRect();
			const screenX = event.clientX - rect.left;
			const screenY = event.clientY - rect.top;
			const newZoom =
				event.deltaY < 0
					? nextZoomLevel(viewport.zoom)
					: prevZoomLevel(viewport.zoom);
			if (newZoom !== viewport.zoom) {
				onViewportChange?.(zoomAtPoint(viewport, screenX, screenY, newZoom));
			}
		};
		canvasEl.addEventListener('wheel', handler, { passive: false });
		return () => canvasEl?.removeEventListener('wheel', handler);
	});

	const cursorStyle = $derived(
		isPanning ? 'grabbing' : isSpaceHeld ? 'grab' : toolCursor
	);

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

	function startPan(event: MouseEvent): void {
		isPanning = true;
		panStartX = event.clientX;
		panStartY = event.clientY;
	}

	function handleMouseDown(event: MouseEvent): void {
		// Middle click → pan
		if (event.button === 1) {
			event.preventDefault();
			startPan(event);
			return;
		}

		if (event.button !== 0) return;

		// Space + left click → pan
		if (isSpaceHeld) {
			startPan(event);
			return;
		}

		isDrawing = true;
		lastPixelX = -1;
		lastPixelY = -1;
		drawAt(getCanvasCoords(event));
	}

	function handleMouseMove(event: MouseEvent): void {
		if (isPanning) return;

		if (!isDrawing) return;
		drawAt(getCanvasCoords(event));
	}

	function handleWindowMouseMove(event: MouseEvent): void {
		if (!isPanning) return;
		const deltaX = event.clientX - panStartX;
		const deltaY = event.clientY - panStartY;
		panStartX = event.clientX;
		panStartY = event.clientY;
		onViewportChange?.(pan(viewport, deltaX, deltaY));
	}

	function handleMouseUp(): void {
		isDrawing = false;
		isPanning = false;
	}

	function handleMouseLeave(event: MouseEvent): void {
		if (isDrawing) {
			drawAt(getCanvasCoords(event));
		}
		isDrawing = false;
	}

	function isInteractiveTarget(target: EventTarget | null): boolean {
		return (
			target instanceof HTMLElement &&
			target.closest('button, input, select, textarea, [contenteditable="true"]') !== null
		);
	}

	function handleKeyDown(event: KeyboardEvent): void {
		if (event.code === 'Space' && !event.repeat && !isInteractiveTarget(event.target)) {
			event.preventDefault();
			isSpaceHeld = true;
		}
	}

	function handleKeyUp(event: KeyboardEvent): void {
		if (event.code === 'Space') {
			isSpaceHeld = false;
		}
	}

	function handleWindowBlur(): void {
		isDrawing = false;
		isPanning = false;
		isSpaceHeld = false;
	}
</script>

<svelte:window
	onmousemove={handleWindowMouseMove}
	onmouseup={handleMouseUp}
	onkeydown={handleKeyDown}
	onkeyup={handleKeyUp}
	onblur={handleWindowBlur}
/>

<canvas
	bind:this={canvasEl}
	class="pixel-canvas"
	style:cursor={cursorStyle}
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
