<script lang="ts">
	import type { CanvasCoords, ReferencePlacement } from './canvas-model';
	import { viewportOps } from './wasm-backend';
	import type { ViewportData, ViewportSize } from './viewport';
	import type { SamplingSession } from './sampling/session.svelte';
	import type { ToolType } from './tool-registry';
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

	type ReferencePlacementHandle = 'nw' | 'ne' | 'se' | 'sw';
	type PlacementNudge = { x: number; y: number };
	type PlacementDragKind =
		| { type: 'move' }
		| {
				type: 'scale';
				handle: ReferencePlacementHandle;
				naturalWidth: number;
				naturalHeight: number;
		  };

	const MIN_REFERENCE_PROJECTED_SIZE = 8;

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
		onReferencePlacementCommit?: (placement: ReferencePlacement) => void;
		activeTool?: ToolType;
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
		onReferencePlacementCommit,
		activeTool = 'pencil',
		toolCursor = 'crosshair',
		isSpaceHeld = false,
		samplingSession
	}: Props = $props();

	let canvasEl: HTMLCanvasElement | undefined = $state();
	let placementOverlayPointerType = $state<PointerType>('mouse');
	let draftReferencePlacement = $state<ReferencePlacement | null>(null);
	let placementDrag:
		| {
				pointerId: number;
				startClientX: number;
				startClientY: number;
				currentLocalX: number;
				currentLocalY: number;
				startPlacement: ReferencePlacement;
				currentPlacement: ReferencePlacement;
				pointerType: PointerType;
				kind: PlacementDragKind;
		  }
		| null = $state(null);
	let pendingOverlayTouch: { id: number; x: number; y: number } | null = null;
	const forwardedOverlayPointerIds = new Set<number>();
	// Last pointer screen coords. Cached so a window resize during an active
	// sampling session can re-fire updatePointer with fresh viewport dimensions
	// without waiting for the next pointer event.
	let lastScreen: { x: number; y: number } | null = null;
	const classifyWheelInput = createWheelInputClassifier();
	const displayedReferenceUnderlay = $derived(
		referenceUnderlay && draftReferencePlacement
			? { ...referenceUnderlay, placement: draftReferencePlacement }
			: referenceUnderlay
	);
	const canMoveReferencePlacementBody = $derived(activeTool === 'move');

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

		renderPixelCanvas(ctx, pixelCanvas, viewport, viewportSize, displayedReferenceUnderlay);
	});

	$effect(() => {
		if (isReferenceLayerActive && referenceUnderlay) return;
		cancelPlacementDrag();
		cancelOverlayPointerState();
	});

	$effect(() => {
		void renderVersion;
		if (!draftReferencePlacement || placementDrag || !referenceUnderlay) return;
		if (isSameReferencePlacement(referenceUnderlay.placement, draftReferencePlacement)) {
			draftReferencePlacement = null;
		}
	});

	// Register wheel listener with { passive: false } to allow preventDefault
	$effect(() => {
		if (!canvasEl) return;
		canvasEl.addEventListener('wheel', handleWheel, { passive: false });
		return () => canvasEl?.removeEventListener('wheel', handleWheel);
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

	function handleWheel(event: WheelEvent): void {
		if (!canvasEl) return;
		if (event.deltaX === 0 && event.deltaY === 0) return;
		event.preventDefault();

		const inputType = classifyWheelInput(
			event.deltaX,
			event.deltaY,
			event.deltaMode,
			event.ctrlKey
		);

		if (inputType === 'trackpadPan') {
			onViewportChange?.(viewportOps.pan(viewport, -event.deltaX, -event.deltaY));
			return;
		}

		const rect = canvasEl.getBoundingClientRect();
		const screenX = event.clientX - rect.left;
		const screenY = event.clientY - rect.top;

		if (inputType === 'pinchZoom') {
			const newZoom = viewportOps.computePinchZoom(viewport.zoom, event.deltaY);
			if (newZoom !== viewport.zoom) {
				onViewportChange?.(viewportOps.zoomAtPoint(viewport, screenX, screenY, newZoom));
			}
			return;
		}

		// wheelZoom: discrete level stepping (mouse wheel)
		const isZoomIn = event.deltaY < 0;
		const newZoom = isZoomIn
			? viewportOps.nextZoomLevel(viewport.zoom)
			: viewportOps.prevZoomLevel(viewport.zoom);
		if (newZoom !== viewport.zoom) {
			onViewportChange?.(viewportOps.zoomAtPoint(viewport, screenX, screenY, newZoom));
		}
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
		focusCanvas();
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
		if (updatePlacementDrag(event)) {
			event.preventDefault();
			return;
		}
		pushPointerToSession(event);
		const { x, y } = toLocal(event);
		canvasInteraction.windowPointerMove(event.pointerId, x, y, event.buttons);
	}

	function handlePointerUp(event: PointerEvent): void {
		if (!canvasEl) return;
		if (commitPlacementDrag(event)) return;
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

	function handleWindowPointerCancel(event: PointerEvent): void {
		if (placementDrag?.pointerId === event.pointerId) {
			cancelPlacementDrag();
			return;
		}
		if (pendingOverlayTouch?.id === event.pointerId) {
			pendingOverlayTouch = null;
			return;
		}
		if (!forwardedOverlayPointerIds.has(event.pointerId)) return;
		forwardedOverlayPointerIds.delete(event.pointerId);
		canvasInteraction.pointerCancel(event.pointerId);
	}

	function handleWindowBlur(): void {
		cancelPlacementDrag();
		clearOverlayPointerState();
		canvasInteraction.blur();
	}

	function handleWindowKeyDown(event: KeyboardEvent): void {
		if (event.key === 'Escape' && placementDrag) {
			event.preventDefault();
			cancelPlacementDrag();
			return;
		}
		if (commitReferencePlacementNudge(event)) {
			event.preventDefault();
		}
	}

	function focusCanvas(): void {
		canvasEl?.focus({ preventScroll: true });
	}

	function clearOverlayPointerState(): void {
		pendingOverlayTouch = null;
		forwardedOverlayPointerIds.clear();
	}

	function cancelOverlayPointerState(): void {
		pendingOverlayTouch = null;
		for (const pointerId of forwardedOverlayPointerIds) {
			canvasInteraction.pointerCancel(pointerId);
		}
		forwardedOverlayPointerIds.clear();
	}

	function scaledCanvasPixel(): number {
		return Math.round(viewport.pixelSize * viewport.zoom);
	}

	function documentDeltaFromDrag(event: PointerEvent): { x: number; y: number } | null {
		if (!placementDrag) return null;
		const pixel = scaledCanvasPixel();
		return {
			x: (event.clientX - placementDrag.startClientX) / pixel,
			y: (event.clientY - placementDrag.startClientY) / pixel
		};
	}

	function placementFromBodyDrag(event: PointerEvent): ReferencePlacement | null {
		if (!placementDrag) return null;
		const delta = documentDeltaFromDrag(event);
		if (!delta) return null;
		return {
			x: placementDrag.startPlacement.x + delta.x,
			y: placementDrag.startPlacement.y + delta.y,
			scale: placementDrag.startPlacement.scale
		};
	}

	function scaleDragSigns(handle: ReferencePlacementHandle): { x: -1 | 1; y: -1 | 1 } {
		switch (handle) {
			case 'nw':
				return { x: -1, y: -1 };
			case 'ne':
				return { x: 1, y: -1 };
			case 'se':
				return { x: 1, y: 1 };
			case 'sw':
				return { x: -1, y: 1 };
		}
	}

	function placementFromScaleDrag(event: PointerEvent): ReferencePlacement | null {
		if (!placementDrag || placementDrag.kind.type !== 'scale') return null;
		const delta = documentDeltaFromDrag(event);
		if (!delta) return null;

		const { handle, naturalWidth, naturalHeight } = placementDrag.kind;
		const start = placementDrag.startPlacement;
		const signs = scaleDragSigns(handle);
		const basisX = signs.x * naturalWidth;
		const basisY = signs.y * naturalHeight;
		const candidateX = signs.x * naturalWidth * start.scale + delta.x;
		const candidateY = signs.y * naturalHeight * start.scale + delta.y;
		const rawScale =
			(candidateX * basisX + candidateY * basisY) / (basisX * basisX + basisY * basisY);
		const minScale = Math.max(
			MIN_REFERENCE_PROJECTED_SIZE / naturalWidth,
			MIN_REFERENCE_PROJECTED_SIZE / naturalHeight
		);
		const scale = Math.max(rawScale, minScale);
		const width = naturalWidth * scale;
		const height = naturalHeight * scale;
		const startRight = start.x + naturalWidth * start.scale;
		const startBottom = start.y + naturalHeight * start.scale;

		switch (handle) {
			case 'nw':
				return { x: startRight - width, y: startBottom - height, scale };
			case 'ne':
				return { x: start.x, y: startBottom - height, scale };
			case 'se':
				return { x: start.x, y: start.y, scale };
			case 'sw':
				return { x: startRight - width, y: start.y, scale };
		}
	}

	function placementFromDrag(event: PointerEvent): ReferencePlacement | null {
		if (placementDrag?.kind.type === 'scale') return placementFromScaleDrag(event);
		return placementFromBodyDrag(event);
	}

	function placementHandleFromEvent(event: PointerEvent): ReferencePlacementHandle | null {
		if (!(event.target instanceof Element)) return null;
		const handleEl = event.target.closest('[data-reference-placement-handle]');
		const handle = handleEl?.getAttribute('data-reference-placement-handle');
		if (handle === 'nw' || handle === 'ne' || handle === 'se' || handle === 'sw') {
			return handle;
		}
		return null;
	}

	function capturePlacementPointer(event: PointerEvent): void {
		if (!(event.currentTarget instanceof HTMLElement)) return;
		if (typeof event.currentTarget.setPointerCapture !== 'function') return;
		try {
			event.currentTarget.setPointerCapture(event.pointerId);
		} catch {
			// Drag still works through window handlers when capture is unavailable.
		}
	}

	function startPlacementDrag(event: PointerEvent, local: { x: number; y: number }): boolean {
		if (!referenceUnderlay || !isReferenceLayerActive || isSpaceHeld || event.button !== 0) {
			return false;
		}
		const startPlacement = referenceUnderlay.placement;
		const handle = placementHandleFromEvent(event);
		if (!handle && !canMoveReferencePlacementBody) return false;
		placementDrag = {
			pointerId: event.pointerId,
			startClientX: event.clientX,
			startClientY: event.clientY,
			currentLocalX: local.x,
			currentLocalY: local.y,
			startPlacement,
			currentPlacement: startPlacement,
			pointerType: normalizePointerType(event.pointerType),
			kind: handle
				? {
						type: 'scale',
						handle,
						naturalWidth: referenceUnderlay.naturalWidth,
						naturalHeight: referenceUnderlay.naturalHeight
					}
				: { type: 'move' }
		};
		draftReferencePlacement = startPlacement;
		capturePlacementPointer(event);
		return true;
	}

	function updatePlacementDrag(event: PointerEvent): boolean {
		if (!placementDrag || placementDrag.pointerId !== event.pointerId) return false;
		const next = placementFromDrag(event);
		if (!next) return false;
		const { x, y } = toLocal(event);
		placementDrag = {
			...placementDrag,
			currentPlacement: next,
			currentLocalX: x,
			currentLocalY: y
		};
		draftReferencePlacement = next;
		return true;
	}

	function commitPlacementDrag(event: PointerEvent): boolean {
		if (!placementDrag || placementDrag.pointerId !== event.pointerId) return false;
		const placement = placementDrag.currentPlacement;
		placementDrag = null;
		draftReferencePlacement = null;
		onReferencePlacementCommit?.(placement);
		return true;
	}

	function cancelPlacementDrag(): void {
		placementDrag = null;
		draftReferencePlacement = null;
	}

	function forwardActiveTouchPlacementDrag(): void {
		if (!placementDrag || placementDrag.pointerType !== 'touch') return;
		const activeDrag = placementDrag;
		cancelPlacementDrag();
		canvasInteraction.pointerDown(
			activeDrag.pointerId,
			activeDrag.currentLocalX,
			activeDrag.currentLocalY,
			'touch',
			0
		);
		forwardedOverlayPointerIds.add(activeDrag.pointerId);
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
		focusCanvas();
		if (!canvasEl) {
			blockOverlayPointerEvent(event);
			return;
		}
		const pointerType = normalizePointerType(event.pointerType);
		placementOverlayPointerType = pointerType;
		const { x, y } = toLocal(event);

		if (pointerType !== 'touch' && startPlacementDrag(event, { x, y })) {
			blockOverlayPointerEvent(event);
			return;
		}

		if (pointerType === 'touch') {
			if (placementDrag?.pointerType === 'touch' && placementDrag.pointerId !== event.pointerId) {
				forwardActiveTouchPlacementDrag();
				canvasInteraction.pointerDown(event.pointerId, x, y, pointerType, event.button);
				forwardedOverlayPointerIds.add(event.pointerId);
			} else if (pendingOverlayTouch && pendingOverlayTouch.id !== event.pointerId) {
				forwardPendingOverlayTouch();
				canvasInteraction.pointerDown(event.pointerId, x, y, pointerType, event.button);
				forwardedOverlayPointerIds.add(event.pointerId);
			} else if (canvasInteraction.interactionType !== 'idle') {
				canvasInteraction.pointerDown(event.pointerId, x, y, pointerType, event.button);
				forwardedOverlayPointerIds.add(event.pointerId);
			} else if (startPlacementDrag(event, { x, y })) {
				pendingOverlayTouch = null;
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
		if (updatePlacementDrag(event)) {
			blockOverlayPointerEvent(event);
			return;
		}
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
		if (commitPlacementDrag(event)) {
			blockOverlayPointerEvent(event);
			return;
		}
		if (pendingOverlayTouch?.id === event.pointerId) pendingOverlayTouch = null;
		if (canvasEl && forwardedOverlayPointerIds.has(event.pointerId)) {
			const { x, y } = toLocal(event);
			canvasInteraction.pointerUp(event.pointerId, x, y);
			forwardedOverlayPointerIds.delete(event.pointerId);
		}
		blockOverlayPointerEvent(event);
	}

	function handleOverlayPointerCancel(event: PointerEvent): void {
		if (placementDrag?.pointerId === event.pointerId) {
			cancelPlacementDrag();
			blockOverlayPointerEvent(event);
			return;
		}
		if (pendingOverlayTouch?.id === event.pointerId) pendingOverlayTouch = null;
		if (forwardedOverlayPointerIds.has(event.pointerId)) {
			canvasInteraction.pointerCancel(event.pointerId);
			forwardedOverlayPointerIds.delete(event.pointerId);
		}
		blockOverlayPointerEvent(event);
	}

	function placementNudgeForKey(event: KeyboardEvent): PlacementNudge | null {
		if (event.ctrlKey || event.metaKey || event.altKey) return null;
		const step = event.shiftKey ? 10 : 1;
		switch (event.code) {
			case 'ArrowUp':
				return { x: 0, y: -step };
			case 'ArrowDown':
				return { x: 0, y: step };
			case 'ArrowLeft':
				return { x: -step, y: 0 };
			case 'ArrowRight':
				return { x: step, y: 0 };
			default:
				return null;
		}
	}

	function isSameReferencePlacement(a: ReferencePlacement, b: ReferencePlacement): boolean {
		return a.x === b.x && a.y === b.y && a.scale === b.scale;
	}

	function isPlacementKeyboardTarget(target: EventTarget | null): boolean {
		if (!canvasEl || !(target instanceof Element)) return false;
		return target === canvasEl || target.closest('[data-reference-placement-overlay]') !== null;
	}

	function commitReferencePlacementNudge(event: KeyboardEvent): boolean {
		const delta = placementNudgeForKey(event);
		if (!delta) return false;
		if (!referenceUnderlay || !isReferenceLayerActive || placementDrag) return false;
		if (!isPlacementKeyboardTarget(event.target)) return false;
		if (!onReferencePlacementCommit) return false;
		const placement = draftReferencePlacement ?? referenceUnderlay.placement;
		const next = {
			x: placement.x + delta.x,
			y: placement.y + delta.y,
			scale: placement.scale
		};
		draftReferencePlacement = next;
		onReferencePlacementCommit(next);
		return true;
	}
</script>

<svelte:window
	onpointermove={handleWindowPointerMove}
	onpointerup={handlePointerUp}
	onpointercancel={handleWindowPointerCancel}
	onkeydown={handleWindowKeyDown}
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
	tabindex="0"
	style:cursor={cursorStyle}
	onpointerdown={handlePointerDown}
	onpointermove={handlePointerMove}
	onpointerleave={handlePointerLeave}
	onpointercancel={handlePointerCancel}
	oncontextmenu={(e) => e.preventDefault()}
></canvas>

<ReferenceLayerPlacementOverlay
	referenceUnderlay={displayedReferenceUnderlay}
	{viewport}
	{isReferenceLayerActive}
	pointerType={placementOverlayPointerType}
	canMoveBody={canMoveReferencePlacementBody}
	onReadOnlyPointerDown={handleOverlayPointerDown}
	onReadOnlyPointerMove={handleOverlayPointerMove}
	onReadOnlyPointerUp={handleOverlayPointerUp}
	onReadOnlyPointerCancel={handleOverlayPointerCancel}
	onReadOnlyWheel={handleWheel}
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
