<script lang="ts">
	import { type WasmPixelCanvas, WasmViewport } from '$wasm/dotorixel_wasm';
	import type { CanvasCoords, ViewportSize, ViewportState } from './view-types';
	import * as m from '$lib/paraglide/messages';
	import { createWheelInputClassifier } from './wheel-input.ts';
	import { renderPixelCanvas } from './renderer.ts';

	const MIN_PINCH_DISTANCE = 10;

	type InteractionMode =
		| { readonly type: 'idle' }
		| { type: 'drawing'; lastPixel: CanvasCoords | null }
		| { type: 'panning'; startX: number; startY: number }
		| {
				type: 'pinching';
				initialViewport: WasmViewport;
				initialDistance: number;
				initialMidX: number;
				initialMidY: number;
			};

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
		toolCursor = 'crosshair',
		isSpaceHeld = false
	}: Props = $props();

	let canvasEl: HTMLCanvasElement | undefined = $state();
	let interaction = $state<InteractionMode>({ type: 'idle' });
	const classifyWheelInput = createWheelInputClassifier();
	const activePointers = new Map<number, { x: number; y: number }>();

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

	function pointerDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
		const dx = a.x - b.x;
		const dy = a.y - b.y;
		return Math.sqrt(dx * dx + dy * dy);
	}

	function pointerMidpoint(
		a: { x: number; y: number },
		b: { x: number; y: number }
	): { x: number; y: number } {
		return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
	}

	function getTwoPointersLocal(): [{ x: number; y: number }, { x: number; y: number }] | null {
		if (activePointers.size < 2) return null;
		const rect = canvasEl!.getBoundingClientRect();
		const iter = activePointers.values();
		const a = iter.next().value!;
		const b = iter.next().value!;
		return [
			{ x: a.x - rect.left, y: a.y - rect.top },
			{ x: b.x - rect.left, y: b.y - rect.top }
		];
	}

	function tryEnterPinching(): boolean {
		if (interaction.type === 'pinching') return true;
		const points = getTwoPointersLocal();
		if (!points) return false;
		const [a, b] = points;
		const distance = pointerDistance(a, b);
		if (distance < MIN_PINCH_DISTANCE) return false;
		const mid = pointerMidpoint(a, b);
		interaction = {
			type: 'pinching',
			initialViewport: viewportState.viewport,
			initialDistance: distance,
			initialMidX: mid.x,
			initialMidY: mid.y
		};
		return true;
	}

	function drawAt(coords: CanvasCoords): void {
		if (interaction.type !== 'drawing') return;
		const lastPixel = interaction.lastPixel;
		if (lastPixel && coords.x === lastPixel.x && coords.y === lastPixel.y) return;
		interaction.lastPixel = coords;
		onDraw?.(coords, lastPixel);
	}

	function handlePointerDown(event: PointerEvent): void {
		activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

		if (activePointers.size >= 2) {
			if (interaction.type === 'drawing') {
				onDrawEnd?.();
				interaction = { type: 'idle' };
			}
			tryEnterPinching();
			return;
		}

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
		if (activePointers.has(event.pointerId)) {
			activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
		}

		// Deferred pinch entry: 2 pointers down but not yet pinching
		if (activePointers.size >= 2 && interaction.type !== 'pinching') {
			if (tryEnterPinching()) return;
		}

		if (interaction.type === 'pinching') {
			const points = getTwoPointersLocal();
			if (!points) return;
			const [a, b] = points;

			const currentDistance = pointerDistance(a, b);
			const currentMid = pointerMidpoint(a, b);

			const newZoom = WasmViewport.clamp_zoom(
				interaction.initialViewport.zoom * (currentDistance / interaction.initialDistance)
			);
			const zoomed = interaction.initialViewport.zoom_at_point(
				interaction.initialMidX,
				interaction.initialMidY,
				newZoom
			);
			const panned = zoomed.pan(
				currentMid.x - interaction.initialMidX,
				currentMid.y - interaction.initialMidY
			);
			onViewportChange?.(panned);
			return;
		}

		if (interaction.type === 'panning') {
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
	}

	function handlePointerUp(event: PointerEvent): void {
		activePointers.delete(event.pointerId);

		if (interaction.type === 'pinching') {
			interaction = { type: 'idle' };
			return;
		}

		if (interaction.type === 'drawing') {
			onDrawEnd?.();
		}
		interaction = { type: 'idle' };
	}

	function handlePointerLeave(event: PointerEvent): void {
		if (interaction.type === 'pinching') return;

		if (interaction.type === 'drawing') {
			drawAt(getCanvasCoords(event));
			onDrawEnd?.();
			interaction = { type: 'idle' };
		}
	}

	function handleWindowBlur(): void {
		activePointers.clear();
		if (interaction.type === 'drawing') {
			onDrawEnd?.();
		}
		interaction = { type: 'idle' };
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
></canvas>

<style>
	.pixel-canvas {
		display: block;
		image-rendering: pixelated;
		touch-action: none;
	}
</style>
