<script lang="ts">
	import type { CanvasPoint, MarqueeRegion, ReferencePlacement } from './canvas-model';
	import { viewportOps } from './wasm-backend';
	import { effectivePixelSize, type ViewportData, type ViewportSize } from './viewport';
	import type { SamplingSessionView } from './sampling/types';
	import type { ToolType } from './tool-registry';
	import * as m from '$lib/paraglide/messages';
	import { createWheelInputClassifier } from './wheel-input.ts';
	import {
		renderPixelCanvas,
		type RenderableCanvas
	} from './renderer.ts';
	import type { ReferenceLayerUnderlay } from './reference-layer-underlay';
	import {
		createReferenceLayerPlacementInteraction,
		type ReferencePlacementHandle
	} from './reference-layer-placement-interaction.svelte';
	import ReferenceLayerPlacementOverlay from './ReferenceLayerPlacementOverlay.svelte';
	import SelectionActionBar from './SelectionActionBar.svelte';
	import SelectionOverlay from './SelectionOverlay.svelte';
	import {
		createCanvasInteraction,
		normalizePointerType,
		type PointerType
	} from './canvas-interaction.svelte';
	import type { SelectionDragAid, SelectionDragPhase } from './selection-drag-aids';
	import { isDrawingTool } from './tool-registry';
	import Loupe from '$lib/ui-editor/Loupe.svelte';

	interface Props {
		pixelCanvas: RenderableCanvas;
		referenceLayerUnderlay?: ReferenceLayerUnderlay;
		marquee?: MarqueeRegion | null;
		floatingSelectionOffset?: { readonly dx: number; readonly dy: number } | null;
		isReferenceLayerActive?: boolean;
		viewport: ViewportData;
		viewportSize?: ViewportSize;
		renderVersion?: number;
		onDraw?: (current: CanvasPoint, previous: CanvasPoint | null) => void;
		onDrawStart?: (button: number, pointerType: PointerType) => void;
		onDrawEnd?: () => void;
		onDrawCancel?: () => void;
		onViewportChange?: (viewport: ViewportData) => void;
		onSampleStart?: (coords: CanvasPoint, button: number, pointerType: PointerType) => boolean;
		onSampleUpdate?: (coords: CanvasPoint) => void;
		onSampleEnd?: () => void;
		onSampleCancel?: () => void;
		onReferencePlacementCommit?: (placement: ReferencePlacement) => void;
		canPasteSelection?: boolean;
		onCopySelection?: () => void;
		onCutSelection?: () => void;
		onPasteSelectionClipboard?: () => void;
		onDeleteMarqueePixels?: () => void;
		onClearMarqueeOrFloating?: () => void;
		onCommitFloatingSelection?: () => void;
		onDuplicateFloatingSelection?: () => void;
		activeTool?: ToolType;
		toolCursor?: string;
		selectionDragPhase?: SelectionDragPhase;
		isSpaceHeld?: boolean;
		/**
		 * Provided by the owning editor when a color-sampling session is available.
		 * When active, the Loupe overlay renders next to the pointer. Optional so
		 * Storybook stories and other consumers without a session still render.
		 */
		samplingSession?: SamplingSessionView;
	}

	let {
		pixelCanvas,
		referenceLayerUnderlay,
		marquee,
		floatingSelectionOffset,
		isReferenceLayerActive = false,
		viewport,
		viewportSize = { width: 512, height: 512 },
		renderVersion = 0,
		onDraw,
		onDrawStart,
		onDrawEnd,
		onDrawCancel,
		onViewportChange,
		onSampleStart,
		onSampleUpdate,
		onSampleEnd,
		onSampleCancel,
		onReferencePlacementCommit,
		canPasteSelection = false,
		onCopySelection,
		onCutSelection,
		onPasteSelectionClipboard,
		onDeleteMarqueePixels,
		onClearMarqueeOrFloating,
		onCommitFloatingSelection,
		onDuplicateFloatingSelection,
		activeTool = 'pencil',
		toolCursor = 'crosshair',
		selectionDragPhase = 'defineMarquee',
		isSpaceHeld = false,
		samplingSession
	}: Props = $props();

	let canvasEl: HTMLCanvasElement | undefined = $state();
	let placementOverlayPointerType = $state<PointerType>('mouse');
	let selectionDragAid = $state<SelectionDragAid | null>(null);
	let selectionHoverCoords = $state<CanvasPoint | null>(null);
	let pendingOverlayTouch: { id: number; x: number; y: number } | null = null;
	const forwardedOverlayPointerIds = new Set<number>();
	const forwardedOverlayDrawPointerIds = new Set<number>();
	// Last pointer screen coords. Cached so a window resize during an active
	// sampling session can re-fire updatePointer with fresh viewport dimensions
	// without waiting for the next pointer event.
	let lastScreen: { x: number; y: number } | null = null;
	const classifyWheelInput = createWheelInputClassifier();
	const placementInteraction = createReferenceLayerPlacementInteraction();
	const displayedReferenceLayerUnderlay = $derived(
		placementInteraction.displayedUnderlay(referenceLayerUnderlay)
	);
	const canMoveReferencePlacementBody = $derived(activeTool === 'move');
	const activeSelectionDragPhase = $derived(
		floatingSelectionOffset ? 'liftAndDrag' : selectionDragPhase
	);

	const canvasInteraction = createCanvasInteraction(
		{
			screenToCanvas: (x, y) => viewportOps.screenToCanvas(viewport, x, y),
			screenToDrawTarget: (x, y) =>
				isReferenceLayerActive && activeTool === 'eyedropper'
					? viewportOps.screenToCanvasPoint(viewport, x, y)
					: viewportOps.screenToCanvas(viewport, x, y),
			screenToSamplingTarget: (x, y) =>
				isReferenceLayerActive
					? viewportOps.screenToCanvasPoint(viewport, x, y)
					: viewportOps.screenToCanvas(viewport, x, y),
			getViewport: () => viewport,
			isSpaceHeld: () => isSpaceHeld
		},
		{
			onDrawStart: (button, pointerType) => onDrawStart?.(button, pointerType),
			onDraw: (c, p) => onDraw?.(c, p),
			onDrawEnd: () => onDrawEnd?.(),
			onDrawCancel: () => onDrawCancel?.(),
			onViewportChange: (vp) => onViewportChange?.(vp),
			onSampleStart: (coords, button, pointerType) =>
				onSampleStart?.(coords, button, pointerType) ?? false,
			onSampleUpdate: (coords) => onSampleUpdate?.(coords),
			onSampleEnd: () => onSampleEnd?.(),
			onSampleCancel: () => onSampleCancel?.()
		}
	);
	const isSelectionActionBarDragging = $derived(canvasInteraction.interactionType !== 'idle');

	$effect(() => {
		if (!canvasEl) return;
		const ctx = canvasEl.getContext('2d');
		if (!ctx) return;

		void renderVersion;

		canvasEl.width = viewportSize.width;
		canvasEl.height = viewportSize.height;

		renderPixelCanvas(ctx, pixelCanvas, viewport, viewportSize, displayedReferenceLayerUnderlay);
	});

	$effect(() => {
		if (isReferenceLayerActive && referenceLayerUnderlay) return;
		placementInteraction.cancelAll();
		cancelOverlayPointerState();
	});

	$effect(() => {
		void renderVersion;
		placementInteraction.reconcileCommittedPlacement(referenceLayerUnderlay);
	});

	// Register wheel listener with { passive: false } to allow preventDefault
	$effect(() => {
		if (!canvasEl) return;
		canvasEl.addEventListener('wheel', handleWheel, { passive: false });
		return () => canvasEl?.removeEventListener('wheel', handleWheel);
	});

	$effect(() => {
		if (activeTool === 'selection' && canvasInteraction.interactionType === 'drawing') return;
		selectionDragAid = null;
	});

	const toolCursorStyle = $derived(
		isReferenceLayerActive && isDrawingTool(activeTool) && placementOverlayPointerType !== 'touch'
			? 'not-allowed'
			: toolCursor
	);
	const selectionCursorStyle = $derived.by(() => {
		if (activeTool !== 'selection' || toolCursorStyle === 'not-allowed') return toolCursorStyle;
		if (floatingSelectionOffset) return 'grabbing';
		if (!marquee || !selectionHoverCoords) return toolCursorStyle;
		return marquee.contains(Math.floor(selectionHoverCoords.x), Math.floor(selectionHoverCoords.y))
			? 'move'
			: toolCursorStyle;
	});
	const cursorStyle = $derived(
		canvasInteraction.interactionType === 'panning'
			? 'grabbing'
			: isSpaceHeld
				? 'grab'
				: selectionCursorStyle
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

	function updateSelectionDragAid(point: { x: number; y: number }): void {
		if (activeTool !== 'selection') return;
		if (canvasInteraction.interactionType !== 'drawing') return;
		selectionDragAid = {
			phase: activeSelectionDragPhase,
			pointer: point
		};
	}

	function clearSelectionDragAid(): void {
		selectionDragAid = null;
	}

	function updateSelectionHover(point: { x: number; y: number }): void {
		selectionHoverCoords = viewportOps.screenToCanvasPoint(viewport, point.x, point.y);
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
		updateSelectionHover({ x, y });
	}

	function handlePointerMove(event: PointerEvent): void {
		placementOverlayPointerType = normalizePointerType(event.pointerType);
		pushPointerToSession(event);
		const { x, y } = toLocal(event);
		canvasInteraction.pointerMove(x, y);
		updateSelectionHover({ x, y });
		updateSelectionDragAid({ x, y });
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
		updateSelectionHover({ x, y });
		updateSelectionDragAid({ x, y });
	}

	function handlePointerUp(event: PointerEvent): void {
		if (!canvasEl) return;
		if (commitPlacementDrag(event)) {
			clearSelectionDragAid();
			return;
		}
		forwardedOverlayPointerIds.delete(event.pointerId);
		forwardedOverlayDrawPointerIds.delete(event.pointerId);
		if (pendingOverlayTouch?.id === event.pointerId) pendingOverlayTouch = null;
		const { x, y } = toLocal(event);
		canvasInteraction.pointerUp(event.pointerId, x, y);
		clearSelectionDragAid();
	}

	function handlePointerLeave(event: PointerEvent): void {
		const { x, y } = toLocal(event);
		canvasInteraction.pointerLeave(x, y);
		selectionHoverCoords = null;
		clearSelectionDragAid();
	}

	function handlePointerCancel(event: PointerEvent): void {
		forwardedOverlayPointerIds.delete(event.pointerId);
		forwardedOverlayDrawPointerIds.delete(event.pointerId);
		if (pendingOverlayTouch?.id === event.pointerId) pendingOverlayTouch = null;
		canvasInteraction.pointerCancel(event.pointerId);
		clearSelectionDragAid();
	}

	function handleWindowPointerCancel(event: PointerEvent): void {
		if (placementInteraction.cancelDrag(event.pointerId)) {
			clearSelectionDragAid();
			return;
		}
		if (pendingOverlayTouch?.id === event.pointerId) {
			pendingOverlayTouch = null;
			clearSelectionDragAid();
			return;
		}
		if (!forwardedOverlayPointerIds.has(event.pointerId)) return;
		forwardedOverlayPointerIds.delete(event.pointerId);
		forwardedOverlayDrawPointerIds.delete(event.pointerId);
		canvasInteraction.pointerCancel(event.pointerId);
		clearSelectionDragAid();
	}

	function handleWindowBlur(): void {
		placementInteraction.cancelAll();
		clearOverlayPointerState();
		canvasInteraction.blur();
		clearSelectionDragAid();
	}

	function handleWindowKeyDown(event: KeyboardEvent): void {
		if (event.key === 'Escape' && placementInteraction.isDragging) {
			event.preventDefault();
			placementInteraction.cancelAll();
			return;
		}
		if (
			event.key === 'Escape' &&
			activeTool === 'selection' &&
			floatingSelectionOffset &&
			canvasInteraction.interactionType === 'drawing'
		) {
			event.preventDefault();
			event.stopImmediatePropagation();
			canvasInteraction.cancelDrawing();
			clearSelectionDragAid();
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
		forwardedOverlayDrawPointerIds.clear();
	}

	function cancelOverlayPointerState(): void {
		pendingOverlayTouch = null;
		for (const pointerId of forwardedOverlayPointerIds) {
			canvasInteraction.pointerCancel(pointerId);
		}
		forwardedOverlayPointerIds.clear();
		forwardedOverlayDrawPointerIds.clear();
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
		const handle = placementHandleFromEvent(event);
		const started = placementInteraction.beginDrag({
			pointerId: event.pointerId,
			pointerType: normalizePointerType(event.pointerType),
			button: event.button,
			clientX: event.clientX,
			clientY: event.clientY,
			localX: local.x,
			localY: local.y,
			referenceLayerUnderlay,
			isReferenceLayerActive,
			isSpaceHeld,
			handle,
			canMoveBody: canMoveReferencePlacementBody
		});
		if (started) capturePlacementPointer(event);
		return started;
	}

	function updatePlacementDrag(event: PointerEvent): boolean {
		const { x, y } = toLocal(event);
		return placementInteraction.updateDrag({
			pointerId: event.pointerId,
			clientX: event.clientX,
			clientY: event.clientY,
			localX: x,
			localY: y,
			scaledCanvasPixel: effectivePixelSize(viewport)
		});
	}

	function commitPlacementDrag(event: PointerEvent): boolean {
		const placement = placementInteraction.commitDrag(event.pointerId);
		if (!placement) return false;
		onReferencePlacementCommit?.(placement);
		return true;
	}

	function forwardActiveTouchPlacementDrag(): void {
		const activeDrag = placementInteraction.cancelActiveTouchDrag();
		if (!activeDrag) return;
		canvasInteraction.pointerDown(
			activeDrag.pointerId,
			activeDrag.localX,
			activeDrag.localY,
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

	function forwardOverlayDrawPointer(
		event: PointerEvent,
		local: { x: number; y: number },
		pointerType: PointerType
	): void {
		canvasInteraction.pointerDown(event.pointerId, local.x, local.y, pointerType, event.button);
		forwardedOverlayPointerIds.add(event.pointerId);
		forwardedOverlayDrawPointerIds.add(event.pointerId);
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
			const activeTouchDrag = placementInteraction.activeTouchDrag();
			if (activeTouchDrag && activeTouchDrag.pointerId !== event.pointerId) {
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
		} else if (activeTool === 'eyedropper' && (event.button === 0 || event.button === 2)) {
			forwardOverlayDrawPointer(event, { x, y }, pointerType);
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
			if (forwardedOverlayDrawPointerIds.has(event.pointerId)) {
				canvasInteraction.pointerMove(x, y);
			} else {
				canvasInteraction.windowPointerMove(event.pointerId, x, y, event.buttons);
			}
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
			forwardedOverlayDrawPointerIds.delete(event.pointerId);
		}
		blockOverlayPointerEvent(event);
	}

	function handleOverlayPointerCancel(event: PointerEvent): void {
		if (placementInteraction.cancelDrag(event.pointerId)) {
			blockOverlayPointerEvent(event);
			return;
		}
		if (pendingOverlayTouch?.id === event.pointerId) pendingOverlayTouch = null;
		if (forwardedOverlayPointerIds.has(event.pointerId)) {
			canvasInteraction.pointerCancel(event.pointerId);
			forwardedOverlayPointerIds.delete(event.pointerId);
			forwardedOverlayDrawPointerIds.delete(event.pointerId);
		}
		blockOverlayPointerEvent(event);
	}

	function isPlacementKeyboardTarget(target: EventTarget | null): boolean {
		if (!canvasEl || !(target instanceof Element)) return false;
		return target === canvasEl || target.closest('[data-reference-placement-overlay]') !== null;
	}

	function commitReferencePlacementNudge(event: KeyboardEvent): boolean {
		if (!onReferencePlacementCommit) return false;
		const next = placementInteraction.nudge({
			code: event.code,
			shiftKey: event.shiftKey,
			ctrlKey: event.ctrlKey,
			metaKey: event.metaKey,
			altKey: event.altKey,
			isKeyboardTarget: isPlacementKeyboardTarget(event.target),
			referenceLayerUnderlay,
			isReferenceLayerActive
		});
		if (!next) return false;
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
	referenceLayerUnderlay={displayedReferenceLayerUnderlay}
	{viewport}
	{isReferenceLayerActive}
	pointerType={placementOverlayPointerType}
	bodyCursor={cursorStyle}
	onReadOnlyPointerDown={handleOverlayPointerDown}
	onReadOnlyPointerMove={handleOverlayPointerMove}
	onReadOnlyPointerUp={handleOverlayPointerUp}
	onReadOnlyPointerCancel={handleOverlayPointerCancel}
	onReadOnlyWheel={handleWheel}
/>

<SelectionOverlay
	{marquee}
	{floatingSelectionOffset}
	canvasWidth={pixelCanvas.width}
	canvasHeight={pixelCanvas.height}
	{viewport}
	{viewportSize}
	dragAid={selectionDragAid}
/>

<SelectionActionBar
	{marquee}
	{floatingSelectionOffset}
	canvasWidth={pixelCanvas.width}
	canvasHeight={pixelCanvas.height}
	{viewport}
	{viewportSize}
	canPaste={canPasteSelection}
	isDragging={isSelectionActionBarDragging}
	{onCopySelection}
	{onCutSelection}
	{onPasteSelectionClipboard}
	{onDeleteMarqueePixels}
	{onClearMarqueeOrFloating}
	{onCommitFloatingSelection}
	{onDuplicateFloatingSelection}
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
