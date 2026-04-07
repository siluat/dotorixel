<script lang="ts">
	import type { PixelCanvas } from './pixel-canvas';
	import type { Viewport } from './viewport';
	import { viewportOps } from './wasm-backend';
	import type { CanvasCoords, ViewportSize, ViewportState } from './view-types';
	import * as m from '$lib/paraglide/messages';
	import { createWheelInputClassifier } from './wheel-input.ts';
	import { renderPixelCanvas } from './renderer.ts';
	import { createCanvasInteraction } from './canvas-interaction.svelte';

	interface Props {
		pixelCanvas: PixelCanvas;
		viewportState: ViewportState;
		viewportSize?: ViewportSize;
		renderVersion?: number;
		renderViewport: {
			pixelSize: number;
			zoom: number;
			panX: number;
			panY: number;
			showGrid: boolean;
			gridColor: string;
		};
		onDraw?: (current: CanvasCoords, previous: CanvasCoords | null) => void;
		onDrawStart?: (button: number) => void;
		onDrawEnd?: () => void;
		onViewportChange?: (viewport: Viewport) => void;
		onLongPress?: (coords: CanvasCoords, button: number) => boolean;
		toolCursor?: string;
		isSpaceHeld?: boolean;
	}

	let {
		pixelCanvas,
		viewportState,
		viewportSize = { width: 512, height: 512 },
		renderVersion = 0,
		renderViewport,
		onDraw,
		onDrawStart,
		onDrawEnd,
		onViewportChange,
		onLongPress,
		toolCursor = 'crosshair',
		isSpaceHeld = false
	}: Props = $props();

	let canvasEl: HTMLCanvasElement | undefined = $state();
	const classifyWheelInput = createWheelInputClassifier();

	const canvasInteraction = createCanvasInteraction(
		{
			screenToCanvas: (x, y) => {
				const coords = viewportState.viewport.screen_to_canvas(x, y);
				return { x: coords.x, y: coords.y };
			},
			getViewport: () => viewportState.viewport,
			isSpaceHeld: () => isSpaceHeld
		},
		{
			onDrawStart: (button) => onDrawStart?.(button),
			onDraw: (c, p) => onDraw?.(c, p),
			onDrawEnd: () => onDrawEnd?.(),
			onViewportChange: (vp) => onViewportChange?.(vp),
			onLongPress: (coords, button) => onLongPress?.(coords, button) ?? false
		}
	);

	$effect(() => {
		if (!canvasEl) return;
		const ctx = canvasEl.getContext('2d');
		if (!ctx) return;

		void renderVersion;

		canvasEl.width = viewportSize.width;
		canvasEl.height = viewportSize.height;

		renderPixelCanvas(ctx, pixelCanvas, renderViewport, viewportSize);
	});

	// Register wheel listener with { passive: false } to allow preventDefault
	$effect(() => {
		if (!canvasEl) return;
		const vp = viewportState.viewport;
		const handler = (event: WheelEvent) => {
			if (event.deltaX === 0 && event.deltaY === 0) return;
			event.preventDefault();

			const inputType = classifyWheelInput(
				event.deltaX,
				event.deltaY,
				event.deltaMode,
				event.ctrlKey
			);

			if (inputType === 'trackpadPan') {
				onViewportChange?.(vp.pan(-event.deltaX, -event.deltaY));
				return;
			}

			const rect = canvasEl!.getBoundingClientRect();
			const screenX = event.clientX - rect.left;
			const screenY = event.clientY - rect.top;

			if (inputType === 'pinchZoom') {
				const newZoom = viewportOps.computePinchZoom(vp.zoom, event.deltaY);
				if (newZoom !== vp.zoom) {
					onViewportChange?.(vp.zoom_at_point(screenX, screenY, newZoom));
				}
				return;
			}

			// wheelZoom: discrete level stepping (mouse wheel)
			const isZoomIn = event.deltaY < 0;
			const newZoom = isZoomIn
				? viewportOps.nextZoomLevel(vp.zoom)
				: viewportOps.prevZoomLevel(vp.zoom);
			if (newZoom !== vp.zoom) {
				onViewportChange?.(vp.zoom_at_point(screenX, screenY, newZoom));
			}
		};
		canvasEl.addEventListener('wheel', handler, { passive: false });
		return () => canvasEl?.removeEventListener('wheel', handler);
	});

	const cursorStyle = $derived(
		canvasInteraction.interactionType === 'panning'
			? 'grabbing'
			: isSpaceHeld
				? 'grab'
				: toolCursor
	);

	function toLocal(event: PointerEvent): { x: number; y: number } {
		const rect = canvasEl!.getBoundingClientRect();
		return { x: event.clientX - rect.left, y: event.clientY - rect.top };
	}

	function handlePointerDown(event: PointerEvent): void {
		if (event.button === 1 || event.button === 2) event.preventDefault();
		const { x, y } = toLocal(event);
		canvasInteraction.pointerDown(event.pointerId, x, y, event.pointerType, event.button);
	}

	function handlePointerMove(event: PointerEvent): void {
		const { x, y } = toLocal(event);
		canvasInteraction.pointerMove(x, y);
	}

	function handleWindowPointerMove(event: PointerEvent): void {
		if (!canvasEl) return;
		const { x, y } = toLocal(event);
		canvasInteraction.windowPointerMove(event.pointerId, x, y, event.buttons);
	}

	function handlePointerUp(event: PointerEvent): void {
		if (!canvasEl) return;
		const { x, y } = toLocal(event);
		canvasInteraction.pointerUp(event.pointerId, x, y);
	}

	function handlePointerLeave(event: PointerEvent): void {
		const { x, y } = toLocal(event);
		canvasInteraction.pointerLeave(x, y);
	}

	function handleWindowBlur(): void {
		canvasInteraction.blur();
	}
</script>

<svelte:window
	onpointermove={handleWindowPointerMove}
	onpointerup={handlePointerUp}
	onblur={handleWindowBlur}
/>

<!-- role="application" tells screen readers this is a custom interactive widget (pixel art canvas).
     Svelte flags this because ARIA classifies "application" as a document-structure role, not a widget role. -->
<!-- svelte-ignore a11y_no_interactive_element_to_noninteractive_role -->
<canvas
	bind:this={canvasEl}
	class="pixel-canvas"
	role="application"
	aria-label={m.aria_pixelCanvas()}
	style:cursor={cursorStyle}
	onpointerdown={handlePointerDown}
	onpointermove={handlePointerMove}
	onpointerleave={handlePointerLeave}
	onpointercancel={handlePointerUp}
	oncontextmenu={(e) => e.preventDefault()}
></canvas>

<style>
	.pixel-canvas {
		display: block;
		image-rendering: pixelated;
		touch-action: none;
	}
</style>
