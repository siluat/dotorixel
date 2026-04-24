<script lang="ts">
	import type { PixelCanvas, CanvasCoords } from './canvas-model';
	import { viewportOps } from './wasm-backend';
	import type { ViewportData, ViewportSize } from './viewport';
	import type { SamplingSession } from './sampling-session.svelte';
	import * as m from '$lib/paraglide/messages';
	import { createWheelInputClassifier } from './wheel-input.ts';
	import { renderPixelCanvas } from './renderer.ts';
	import {
		createCanvasInteraction,
		normalizePointerType,
		type PointerType
	} from './canvas-interaction.svelte';
	import Loupe from '$lib/ui-editor/Loupe.svelte';

	interface Props {
		pixelCanvas: PixelCanvas;
		viewport: ViewportData;
		viewportSize?: ViewportSize;
		renderVersion?: number;
		onDraw?: (current: CanvasCoords, previous: CanvasCoords | null) => void;
		onDrawStart?: (button: number, pointerType: PointerType) => void;
		onDrawEnd?: () => void;
		onViewportChange?: (viewport: ViewportData) => void;
		onSampleStart?: (coords: CanvasCoords, button: number, pointerType: PointerType) => boolean;
		onSampleUpdate?: (coords: CanvasCoords) => void;
		onSampleEnd?: () => void;
		onSampleCancel?: () => void;
		toolCursor?: string;
		isSpaceHeld?: boolean;
		/**
		 * Provided by the owning editor when a color-sampling session is available.
		 * When active, the Loupe overlay renders next to the pointer. Optional so
		 * Storybook stories and other consumers without a session still render.
		 */
		samplingSession?: SamplingSession;
	}

	let {
		pixelCanvas,
		viewport,
		viewportSize = { width: 512, height: 512 },
		renderVersion = 0,
		onDraw,
		onDrawStart,
		onDrawEnd,
		onViewportChange,
		onSampleStart,
		onSampleUpdate,
		onSampleEnd,
		onSampleCancel,
		toolCursor = 'crosshair',
		isSpaceHeld = false,
		samplingSession
	}: Props = $props();

	let canvasEl: HTMLCanvasElement | undefined = $state();
	/**
	 * Viewport-relative pointer coordinates for the Loupe. Uses clientX/clientY
	 * directly (not canvas-local) because Loupe is `position: fixed`. Set on
	 * every pointer event (even outside a sampling session) so the overlay has
	 * a fresh position the moment `samplingSession.isActive` flips to true.
	 */
	let screenPointer = $state<{ x: number; y: number } | null>(null);
	/**
	 * Tracks `window.innerWidth/innerHeight` for the Loupe overlay's
	 * fixed-position math. The Loupe needs the document viewport (not the
	 * canvas's local viewport) because it's positioned in screen space.
	 */
	let windowSize = $state({
		width: typeof window === 'undefined' ? 0 : window.innerWidth,
		height: typeof window === 'undefined' ? 0 : window.innerHeight
	});
	const classifyWheelInput = createWheelInputClassifier();

	const canvasInteraction = createCanvasInteraction(
		{
			screenToCanvas: (x, y) => viewportOps.screenToCanvas(viewport, x, y),
			getViewport: () => viewport,
			isSpaceHeld: () => isSpaceHeld
		},
		{
			onDrawStart: (button, pointerType) => onDrawStart?.(button, pointerType),
			onDraw: (c, p) => onDraw?.(c, p),
			onDrawEnd: () => onDrawEnd?.(),
			onViewportChange: (vp) => onViewportChange?.(vp),
			onSampleStart: (coords, button, pointerType) =>
				onSampleStart?.(coords, button, pointerType) ?? false,
			onSampleUpdate: (coords) => onSampleUpdate?.(coords),
			onSampleEnd: () => onSampleEnd?.(),
			onSampleCancel: () => onSampleCancel?.()
		}
	);

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
		const vp = viewport;
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
				onViewportChange?.(viewportOps.pan(vp, -event.deltaX, -event.deltaY));
				return;
			}

			const rect = canvasEl!.getBoundingClientRect();
			const screenX = event.clientX - rect.left;
			const screenY = event.clientY - rect.top;

			if (inputType === 'pinchZoom') {
				const newZoom = viewportOps.computePinchZoom(vp.zoom, event.deltaY);
				if (newZoom !== vp.zoom) {
					onViewportChange?.(viewportOps.zoomAtPoint(vp, screenX, screenY, newZoom));
				}
				return;
			}

			// wheelZoom: discrete level stepping (mouse wheel)
			const isZoomIn = event.deltaY < 0;
			const newZoom = isZoomIn
				? viewportOps.nextZoomLevel(vp.zoom)
				: viewportOps.prevZoomLevel(vp.zoom);
			if (newZoom !== vp.zoom) {
				onViewportChange?.(viewportOps.zoomAtPoint(vp, screenX, screenY, newZoom));
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

	function trackScreenPointer(event: PointerEvent): void {
		screenPointer = { x: event.clientX, y: event.clientY };
	}

	function handlePointerDown(event: PointerEvent): void {
		if (event.button === 1 || event.button === 2) event.preventDefault();
		trackScreenPointer(event);
		const { x, y } = toLocal(event);
		canvasInteraction.pointerDown(
			event.pointerId,
			x,
			y,
			normalizePointerType(event.pointerType),
			event.button
		);
	}

	function handlePointerMove(event: PointerEvent): void {
		trackScreenPointer(event);
		const { x, y } = toLocal(event);
		canvasInteraction.pointerMove(x, y);
	}

	function handleWindowPointerMove(event: PointerEvent): void {
		if (!canvasEl) return;
		trackScreenPointer(event);
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
		screenPointer = null;
	}

	function handleWindowResize(): void {
		windowSize = { width: window.innerWidth, height: window.innerHeight };
	}
</script>

<svelte:window
	onpointermove={handleWindowPointerMove}
	onpointerup={handlePointerUp}
	onblur={handleWindowBlur}
	onresize={handleWindowResize}
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

{#if samplingSession?.isActive && screenPointer}
	<Loupe
		grid={samplingSession.grid}
		{screenPointer}
		viewport={windowSize}
		inputSource={samplingSession.inputSource ?? 'mouse'}
	/>
{/if}

<style>
	.pixel-canvas {
		display: block;
		image-rendering: pixelated;
		touch-action: none;
	}
</style>
