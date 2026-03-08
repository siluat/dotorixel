<script lang="ts">
	import type { PixelCanvas, CanvasCoords } from './canvas.ts';
	import type { ViewportConfig, ViewportSize } from './viewport.ts';
	import { screenToCanvas, zoomAtPoint, pan, nextZoomLevel, prevZoomLevel } from './viewport.ts';
	import { renderPixelCanvas } from './renderer.ts';

	type InteractionMode =
		| { readonly type: 'idle' }
		| { type: 'drawing'; lastPixel: CanvasCoords | null }
		| { type: 'panning'; startX: number; startY: number };

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
	let interaction = $state<InteractionMode>({ type: 'idle' });
	let isSpaceHeld = $state(false);

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
			const isZoomIn = event.deltaY < 0;
			const newZoom = isZoomIn
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
		interaction.type === 'panning' ? 'grabbing' : isSpaceHeld ? 'grab' : toolCursor
	);

	function getCanvasCoords(event: MouseEvent): CanvasCoords {
		const rect = canvasEl!.getBoundingClientRect();
		return screenToCanvas(event.clientX - rect.left, event.clientY - rect.top, viewport);
	}

	function drawAt(coords: CanvasCoords): void {
		if (interaction.type !== 'drawing') return;
		const lastPixel = interaction.lastPixel;
		if (lastPixel && coords.x === lastPixel.x && coords.y === lastPixel.y) return;
		interaction.lastPixel = coords;
		onDraw?.(coords, lastPixel);
	}

	function handleMouseDown(event: MouseEvent): void {
		const isMiddleClick = event.button === 1;
		const isLeftClick = event.button === 0;

		if (isMiddleClick) {
			event.preventDefault();
			interaction = { type: 'panning', startX: event.clientX, startY: event.clientY };
			return;
		}

		if (!isLeftClick) return;

		if (isSpaceHeld) {
			interaction = { type: 'panning', startX: event.clientX, startY: event.clientY };
			return;
		}

		interaction = { type: 'drawing', lastPixel: null };
		drawAt(getCanvasCoords(event));
	}

	function handleMouseMove(event: MouseEvent): void {
		if (interaction.type !== 'drawing') return;
		drawAt(getCanvasCoords(event));
	}

	function handleWindowMouseMove(event: MouseEvent): void {
		if (interaction.type !== 'panning') return;
		const hasLostMouseUp = event.buttons === 0;
		if (hasLostMouseUp) {
			interaction = { type: 'idle' };
			return;
		}
		const deltaX = event.clientX - interaction.startX;
		const deltaY = event.clientY - interaction.startY;
		interaction.startX = event.clientX;
		interaction.startY = event.clientY;
		onViewportChange?.(pan(viewport, deltaX, deltaY));
	}

	function handleMouseUp(): void {
		interaction = { type: 'idle' };
	}

	function handleMouseLeave(event: MouseEvent): void {
		if (interaction.type === 'drawing') {
			drawAt(getCanvasCoords(event));
			interaction = { type: 'idle' };
		}
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
		interaction = { type: 'idle' };
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
