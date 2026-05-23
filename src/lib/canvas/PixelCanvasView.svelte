<script lang="ts">
	import type { CanvasCoords } from './canvas-model';
	import { viewportOps } from './wasm-backend';
	import type { ViewportData, ViewportSize } from './viewport';
	import type { SamplingSession } from './sampling/session.svelte';
	import * as m from '$lib/paraglide/messages';
	import { createWheelInputClassifier } from './wheel-input.ts';
	import {
		renderPixelCanvas,
		type ReferenceUnderlay,
		type RenderableCanvas
	} from './renderer.ts';
	import ReferenceLayerPlacementOverlay from './ReferenceLayerPlacementOverlay.svelte';
	import {
		createCanvasInteraction,
		normalizePointerType,
		type PointerType
	} from './canvas-interaction.svelte';
	import Loupe from '$lib/ui-editor/Loupe.svelte';

	interface Props {
		pixelCanvas: RenderableCanvas;
		referenceUnderlay?: ReferenceUnderlay;
		isReferenceLayerActive?: boolean;
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
		referenceUnderlay,
		isReferenceLayerActive = false,
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
	let placementOverlayPointerType = $state<PointerType>('mouse');
	let pendingOverlayTouch: { id: number; x: number; y: number } | null = null;
	const forwardedOverlayPointerIds = new Set<number>();
	// Last pointer screen coords. Cached so a window resize during an active
	// sampling session can re-fire updatePointer with fresh viewport dimensions
	// without waiting for the next pointer event.
	let lastScreen: { x: number; y: number } | null = null;
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

		renderPixelCanvas(ctx, pixelCanvas, viewport, viewportSize, referenceUnderlay);
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

	function pushPointerToSession(event: PointerEvent): void {
		lastScreen = { x: event.clientX, y: event.clientY };
		samplingSession?.updatePointer({
			screen: lastScreen,
			viewport: { width: window.innerWidth, height: window.innerHeight }
		});
	}

	function handleWindowResize(): void {
		if (!samplingSession || !lastScreen) return;
		samplingSession.updatePointer({
			screen: lastScreen,
			viewport: { width: window.innerWidth, height: window.innerHeight }
		});
	}

	function handlePointerDown(event: PointerEvent): void {
		if (event.button === 1 || event.button === 2) event.preventDefault();
		const pointerType = normalizePointerType(event.pointerType);
		placementOverlayPointerType = pointerType;
		pushPointerToSession(event);
		const { x, y } = toLocal(event);
		if (
			pointerType === 'touch' &&
			pendingOverlayTouch &&
			pendingOverlayTouch.id !== event.pointerId
		) {
			forwardPendingOverlayTouch();
		}
		canvasInteraction.pointerDown(
			event.pointerId,
			x,
			y,
			pointerType,
			event.button
		);
	}

	function handlePointerMove(event: PointerEvent): void {
		placementOverlayPointerType = normalizePointerType(event.pointerType);
		pushPointerToSession(event);
		const { x, y } = toLocal(event);
		canvasInteraction.pointerMove(x, y);
	}

	function handleWindowPointerMove(event: PointerEvent): void {
		if (!canvasEl) return;
		pushPointerToSession(event);
		const { x, y } = toLocal(event);
		canvasInteraction.windowPointerMove(event.pointerId, x, y, event.buttons);
	}

	function handlePointerUp(event: PointerEvent): void {
		if (!canvasEl) return;
		forwardedOverlayPointerIds.delete(event.pointerId);
		if (pendingOverlayTouch?.id === event.pointerId) pendingOverlayTouch = null;
		const { x, y } = toLocal(event);
		canvasInteraction.pointerUp(event.pointerId, x, y);
	}

	function handlePointerLeave(event: PointerEvent): void {
		const { x, y } = toLocal(event);
		canvasInteraction.pointerLeave(x, y);
	}

	function handlePointerCancel(event: PointerEvent): void {
		forwardedOverlayPointerIds.delete(event.pointerId);
		if (pendingOverlayTouch?.id === event.pointerId) pendingOverlayTouch = null;
		canvasInteraction.pointerCancel(event.pointerId);
	}

	function handleWindowBlur(): void {
		pendingOverlayTouch = null;
		forwardedOverlayPointerIds.clear();
		canvasInteraction.blur();
	}

	function blockOverlayPointerEvent(event: PointerEvent): void {
		event.preventDefault();
		event.stopPropagation();
	}

	function forwardPendingOverlayTouch(): void {
		if (!pendingOverlayTouch) return;
		canvasInteraction.pointerDown(
			pendingOverlayTouch.id,
			pendingOverlayTouch.x,
			pendingOverlayTouch.y,
			'touch',
			0
		);
		forwardedOverlayPointerIds.add(pendingOverlayTouch.id);
		pendingOverlayTouch = null;
	}

	function handleOverlayPointerDown(event: PointerEvent): void {
		if (!canvasEl) {
			blockOverlayPointerEvent(event);
			return;
		}
		const pointerType = normalizePointerType(event.pointerType);
		placementOverlayPointerType = pointerType;
		const { x, y } = toLocal(event);

		if (pointerType === 'touch') {
			if (pendingOverlayTouch && pendingOverlayTouch.id !== event.pointerId) {
				forwardPendingOverlayTouch();
				canvasInteraction.pointerDown(event.pointerId, x, y, pointerType, event.button);
				forwardedOverlayPointerIds.add(event.pointerId);
			} else if (canvasInteraction.interactionType !== 'idle') {
				canvasInteraction.pointerDown(event.pointerId, x, y, pointerType, event.button);
				forwardedOverlayPointerIds.add(event.pointerId);
			} else {
				pendingOverlayTouch = { id: event.pointerId, x, y };
			}
			blockOverlayPointerEvent(event);
			return;
		}

		if (event.button === 1 || isSpaceHeld) {
			canvasInteraction.pointerDown(event.pointerId, x, y, pointerType, event.button);
			forwardedOverlayPointerIds.add(event.pointerId);
		}
		blockOverlayPointerEvent(event);
	}

	function handleOverlayPointerMove(event: PointerEvent): void {
		if (!canvasEl) {
			blockOverlayPointerEvent(event);
			return;
		}
		placementOverlayPointerType = normalizePointerType(event.pointerType);
		const { x, y } = toLocal(event);
		if (pendingOverlayTouch?.id === event.pointerId) {
			pendingOverlayTouch = { id: event.pointerId, x, y };
		}
		if (forwardedOverlayPointerIds.has(event.pointerId)) {
			canvasInteraction.windowPointerMove(event.pointerId, x, y, event.buttons);
		}
		blockOverlayPointerEvent(event);
	}

	function handleOverlayPointerUp(event: PointerEvent): void {
		if (pendingOverlayTouch?.id === event.pointerId) pendingOverlayTouch = null;
		if (canvasEl && forwardedOverlayPointerIds.has(event.pointerId)) {
			const { x, y } = toLocal(event);
			canvasInteraction.pointerUp(event.pointerId, x, y);
			forwardedOverlayPointerIds.delete(event.pointerId);
		}
		blockOverlayPointerEvent(event);
	}

	function handleOverlayPointerCancel(event: PointerEvent): void {
		if (pendingOverlayTouch?.id === event.pointerId) pendingOverlayTouch = null;
		if (forwardedOverlayPointerIds.has(event.pointerId)) {
			canvasInteraction.pointerCancel(event.pointerId);
			forwardedOverlayPointerIds.delete(event.pointerId);
		}
		blockOverlayPointerEvent(event);
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
	onpointercancel={handlePointerCancel}
	oncontextmenu={(e) => e.preventDefault()}
></canvas>

<ReferenceLayerPlacementOverlay
	{referenceUnderlay}
	{viewport}
	{isReferenceLayerActive}
	pointerType={placementOverlayPointerType}
	onReadOnlyPointerDown={handleOverlayPointerDown}
	onReadOnlyPointerMove={handleOverlayPointerMove}
	onReadOnlyPointerUp={handleOverlayPointerUp}
	onReadOnlyPointerCancel={handleOverlayPointerCancel}
/>

{#if samplingSession?.position}
	<Loupe grid={samplingSession.grid} position={samplingSession.position} />
{/if}

<style>
	.pixel-canvas {
		display: block;
		image-rendering: pixelated;
		touch-action: none;
	}
</style>
