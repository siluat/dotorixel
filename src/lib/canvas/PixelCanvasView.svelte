<script lang="ts">
	import { type WasmPixelCanvas, WasmViewport } from '$wasm/dotorixel_wasm';
	import type { CanvasCoords, ViewportSize, ViewportState } from './view-types';
	import { createWheelInputClassifier } from './wheel-input.ts';
	import { renderPixelCanvas } from './renderer.ts';

	type InteractionMode =
		| { readonly type: 'idle' }
		| { type: 'drawing'; lastPixel: CanvasCoords | null }
		| { type: 'panning'; startX: number; startY: number };

	interface Props {
		pixelCanvas: WasmPixelCanvas;
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
		onDrawStart?: () => void;
		onDrawEnd?: () => void;
		onViewportChange?: (viewport: WasmViewport) => void;
		toolCursor?: string;
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
		toolCursor = 'crosshair'
	}: Props = $props();

	let canvasEl: HTMLCanvasElement | undefined = $state();
	let interaction = $state<InteractionMode>({ type: 'idle' });
	let isSpaceHeld = $state(false);
	const classifyWheelInput = createWheelInputClassifier();

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
				const newZoom = WasmViewport.compute_pinch_zoom(vp.zoom, event.deltaY);
				if (newZoom !== vp.zoom) {
					onViewportChange?.(vp.zoom_at_point(screenX, screenY, newZoom));
				}
				return;
			}

			// wheelZoom: discrete level stepping (mouse wheel)
			const isZoomIn = event.deltaY < 0;
			const newZoom = isZoomIn
				? WasmViewport.next_zoom_level(vp.zoom)
				: WasmViewport.prev_zoom_level(vp.zoom);
			if (newZoom !== vp.zoom) {
				onViewportChange?.(vp.zoom_at_point(screenX, screenY, newZoom));
			}
		};
		canvasEl.addEventListener('wheel', handler, { passive: false });
		return () => canvasEl?.removeEventListener('wheel', handler);
	});

	const cursorStyle = $derived(
		interaction.type === 'panning' ? 'grabbing' : isSpaceHeld ? 'grab' : toolCursor
	);

	function getCanvasCoords(event: PointerEvent): CanvasCoords {
		const rect = canvasEl!.getBoundingClientRect();
		const coords = viewportState.viewport.screen_to_canvas(
			event.clientX - rect.left,
			event.clientY - rect.top
		);
		return { x: coords.x, y: coords.y };
	}

	function drawAt(coords: CanvasCoords): void {
		if (interaction.type !== 'drawing') return;
		const lastPixel = interaction.lastPixel;
		if (lastPixel && coords.x === lastPixel.x && coords.y === lastPixel.y) return;
		interaction.lastPixel = coords;
		onDraw?.(coords, lastPixel);
	}

	function handlePointerDown(event: PointerEvent): void {
		if (interaction.type !== 'idle') return;

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
		onDrawStart?.();
		drawAt(getCanvasCoords(event));
	}

	function handlePointerMove(event: PointerEvent): void {
		if (interaction.type !== 'drawing') return;
		drawAt(getCanvasCoords(event));
	}

	function handleWindowPointerMove(event: PointerEvent): void {
		if (interaction.type !== 'panning') return;
		const hasNoButtonsPressed = event.buttons === 0;
		if (hasNoButtonsPressed) {
			interaction = { type: 'idle' };
			return;
		}
		const deltaX = event.clientX - interaction.startX;
		const deltaY = event.clientY - interaction.startY;
		interaction.startX = event.clientX;
		interaction.startY = event.clientY;
		onViewportChange?.(viewportState.viewport.pan(deltaX, deltaY));
	}

	function handlePointerUp(): void {
		if (interaction.type === 'drawing') {
			onDrawEnd?.();
		}
		interaction = { type: 'idle' };
	}

	function handlePointerLeave(event: PointerEvent): void {
		if (interaction.type === 'drawing') {
			drawAt(getCanvasCoords(event));
			onDrawEnd?.();
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
		if (interaction.type === 'drawing') {
			onDrawEnd?.();
		}
		interaction = { type: 'idle' };
		isSpaceHeld = false;
	}
</script>

<svelte:window
	onpointermove={handleWindowPointerMove}
	onpointerup={handlePointerUp}
	onkeydown={handleKeyDown}
	onkeyup={handleKeyUp}
	onblur={handleWindowBlur}
/>

<!-- role="application" tells screen readers this is a custom interactive widget (pixel art canvas).
     Svelte flags this because ARIA classifies "application" as a document-structure role, not a widget role. -->
<!-- svelte-ignore a11y_no_interactive_element_to_noninteractive_role -->
<canvas
	bind:this={canvasEl}
	class="pixel-canvas"
	role="application"
	aria-label="Pixel art canvas"
	style:cursor={cursorStyle}
	onpointerdown={handlePointerDown}
	onpointermove={handlePointerMove}
	onpointerleave={handlePointerLeave}
	onpointercancel={handlePointerUp}
></canvas>

<style>
	.pixel-canvas {
		display: block;
		image-rendering: pixelated;
		touch-action: none;
	}
</style>
