<script lang="ts">
	import { tick } from 'svelte';
	import { ChevronDown, Copy, Grid2x2, Image, LoaderCircle, Maximize2, Trash2 } from 'lucide-svelte';
	import * as m from '$lib/paraglide/messages';
	import TransportBar from './TransportBar.svelte';

	type LayerKind = 'pixel' | 'reference';

	interface LayerSummary {
		readonly id: string;
		readonly name: string;
		readonly visible?: boolean;
		readonly kind: LayerKind;
	}

	interface FrameColumn {
		readonly id: string;
		/** Pixel Layer ids whose Cel at this frame is content-bearing (renders a dot). */
		readonly occupiedLayerIds: ReadonlySet<string>;
		/** Display time in milliseconds during playback. */
		readonly durationMs: number;
	}

	interface Props {
		layers: ReadonlyArray<LayerSummary>;
		activeLayerId: string;
		frames: ReadonlyArray<FrameColumn>;
		activeFrameId: string;
		collapsed: boolean;
		onAddLayer: () => void;
		onAddReferenceLayer: () => void;
		onActivateLayer: (id: string) => void;
		onRemoveLayer: (id: string) => void;
		onReorderLayer: (id: string, newVisualIndex: number) => void;
		onToggleLayerVisibility: (id: string, newVisible: boolean) => void;
		onToggleCollapsed: () => void;
		onFitReferenceLayerToCanvas: (id: string) => void;
		onSelectFrame: (frameId: string) => void;
		onSelectCel: (layerId: string, frameId: string) => void;
		onAddFrame: () => void;
		onDuplicateFrame: () => void;
		onRemoveFrame: (frameId: string) => void;
		onReorderFrame: (frameId: string, newIndex: number) => void;
		onSetFrameDuration: (frameId: string, durationMs: number) => void;
		isReferenceLayerImporting?: boolean;
		referenceLayerImportName?: string;
		// Transport (playback) state + commands. Optional so non-playback render
		// sites (e.g. Storybook) keep working; the editor wires all of them.
		isPlaying?: boolean;
		isLooping?: boolean;
		/** The frame the Playhead shows while playing, or null while stopped. */
		playheadFrameId?: string | null;
		onTogglePlay?: () => void;
		onToggleLoop?: () => void;
	}

	let {
		layers,
		activeLayerId,
		frames,
		activeFrameId,
		collapsed,
		onAddLayer,
		onAddReferenceLayer,
		onActivateLayer,
		onRemoveLayer,
		onReorderLayer,
		onToggleLayerVisibility,
		onToggleCollapsed,
		onFitReferenceLayerToCanvas,
		onSelectFrame,
		onSelectCel,
		onAddFrame,
		onDuplicateFrame,
		onRemoveFrame,
		onReorderFrame,
		onSetFrameDuration,
		isReferenceLayerImporting = false,
		referenceLayerImportName,
		isPlaying = false,
		isLooping = false,
		playheadFrameId = null,
		onTogglePlay = () => {},
		onToggleLoop = () => {}
	}: Props = $props();

	// Fallback row height used when the DOM has no layout (e.g. headless test
	// environments where offsetHeight is 0). Matches the docked-mode --row-height.
	const DEFAULT_ROW_HEIGHT_PX = 32;

	const activeLayerName = $derived(
		layers.find((l) => l.id === activeLayerId)?.name ?? ''
	);
	const activeFrameOrdinal = $derived(
		frames.findIndex((frameCol) => frameCol.id === activeFrameId) + 1
	);
	// 1-based Playhead position (0 when the id isn't found / stopped).
	const playheadOrdinal = $derived(
		playheadFrameId !== null
			? frames.findIndex((frameCol) => frameCol.id === playheadFrameId) + 1
			: 0
	);
	// The transport readout follows the Playhead while playing, else the Active Frame
	// (the frame you return to on stop). One readout, two sources — the 200 design.
	const transportPosition = $derived(
		isPlaying && playheadOrdinal > 0 ? playheadOrdinal : activeFrameOrdinal
	);
	const activeFrameDurationMs = $derived(
		frames.find((frameCol) => frameCol.id === activeFrameId)?.durationMs ?? 0
	);
	// Read-only fps helper derived from the duration (1000 / ms); shown on desktop,
	// hidden on mobile (194 design). Guarded so the 0 fallback never divides.
	const activeFrameFps = $derived(
		activeFrameDurationMs > 0 ? Math.round(1000 / activeFrameDurationMs) : 0
	);

	// Controlled draft for the duration editor: it mirrors the active frame's
	// stored duration but holds the user's raw in-progress text while editing (a
	// plain string — empty when the field is blank). A text input (not type=number)
	// keeps the entry under our control: no browser spinner, no value quirks. The
	// effect below seeds it before first paint and re-syncs it from the stored value
	// whenever that changes — frame switch, undo, or the post-commit clamp
	// round-trip. Typing only mutates the draft, so this never clobbers a mid-edit
	// value (the stored value is unchanged then).
	let durationDraft = $state('');
	$effect(() => {
		durationDraft = String(activeFrameDurationMs);
	});

	const renderedLayers = $derived(
		isReferenceLayerImporting ? layers.filter((layer) => layer.kind !== 'reference') : layers
	);
	const busyReferenceName = $derived(referenceLayerImportName || m.reference_layer_loading());

	let draggingId = $state<string | null>(null);
	let draggingPointerId = $state<number | null>(null);
	let dragStartY = $state(0);
	let dragBaseIndex = $state(0);
	let dragTargetIndex = $state<number | null>(null);
	let dragOffsetY = $state(0);
	let dragRowHeight = $state(DEFAULT_ROW_HEIGHT_PX);

	const pixelVisualIndices = $derived.by(() =>
		renderedLayers.flatMap((layer, index) => (layer.kind === 'pixel' ? [index] : []))
	);
	const canReorderPixels = $derived(pixelVisualIndices.length > 1);

	function pixelReorderTarget(visualIndex: number, direction: -1 | 1): number | null {
		const current = pixelVisualIndices.indexOf(visualIndex);
		if (current === -1) return null;
		return pixelVisualIndices[current + direction] ?? null;
	}

	function clampToPixelReorderTarget(candidate: number): number {
		const bounded = Math.max(0, Math.min(renderedLayers.length - 1, candidate));
		for (const index of pixelVisualIndices) {
			if (bounded <= index) return index;
		}
		return pixelVisualIndices.at(-1) ?? bounded;
	}

	function handleReorderKey(event: KeyboardEvent, id: string, visualIndex: number) {
		if (event.key === 'ArrowUp') {
			event.preventDefault();
			const target = pixelReorderTarget(visualIndex, -1);
			if (target !== null) onReorderLayer(id, target);
		} else if (event.key === 'ArrowDown') {
			event.preventDefault();
			const target = pixelReorderTarget(visualIndex, 1);
			if (target !== null) onReorderLayer(id, target);
		} else if (event.key === 'Enter' || event.key === ' ') {
			// Stop the row's Enter/Space activation handler from firing; the
			// handle is for reordering, not activation.
			event.stopPropagation();
		}
	}

	function releaseCapture(target: Element, pointerId: number) {
		try {
			(target as Element & { releasePointerCapture(id: number): void }).releasePointerCapture(
				pointerId
			);
		} catch {
			// happy-dom or browsers that lack support — ignore.
		}
	}

	function computeTargetIndex(clientY: number): number {
		const deltaY = clientY - dragStartY;
		const offset = Math.round(deltaY / dragRowHeight);
		const candidate = dragBaseIndex + offset;
		return clampToPixelReorderTarget(candidate);
	}

	function clampDragOffsetY(clientY: number): number {
		const deltaY = clientY - dragStartY;
		const firstPixelIndex = pixelVisualIndices[0] ?? dragBaseIndex;
		const lastPixelIndex = pixelVisualIndices.at(-1) ?? dragBaseIndex;
		const minOffset = (firstPixelIndex - dragBaseIndex) * dragRowHeight;
		const maxOffset = (lastPixelIndex - dragBaseIndex) * dragRowHeight;
		return Math.max(minOffset, Math.min(maxOffset, deltaY));
	}

	function updateDragPreview(clientY: number) {
		dragOffsetY = clampDragOffsetY(clientY);
		dragTargetIndex = computeTargetIndex(clientY);
	}

	function resetDrag() {
		draggingId = null;
		draggingPointerId = null;
		dragTargetIndex = null;
		dragOffsetY = 0;
	}

	function dragTranslateY(id: string, visualIndex: number): number {
		if (draggingId === null || dragTargetIndex === null) return 0;
		if (id === draggingId) return dragOffsetY;
		if (dragBaseIndex < dragTargetIndex) {
			return visualIndex > dragBaseIndex && visualIndex <= dragTargetIndex ? -dragRowHeight : 0;
		}
		if (dragBaseIndex > dragTargetIndex) {
			return visualIndex >= dragTargetIndex && visualIndex < dragBaseIndex ? dragRowHeight : 0;
		}
		return 0;
	}

	function dragStyle(offsetY: number): string | undefined {
		return offsetY === 0 ? undefined : `--layer-drag-y: ${offsetY}px;`;
	}

	function handlePointerDown(event: PointerEvent, id: string, visualIndex: number) {
		// Ignore secondary pointers (e.g. a second finger on a multi-touch device)
		// while a drag is in progress — only the initiating pointer drives it.
		if (draggingId !== null) return;
		if (!canReorderPixels) return;
		if (event.button !== 0) return;
		const target = event.currentTarget as HTMLElement;
		const row = target.closest('[data-layer-row]') as HTMLElement | null;
		const measured = row?.offsetHeight ?? 0;

		draggingId = id;
		draggingPointerId = event.pointerId;
		dragStartY = event.clientY;
		dragBaseIndex = visualIndex;
		dragTargetIndex = visualIndex;
		dragOffsetY = 0;
		dragRowHeight = measured > 0 ? measured : DEFAULT_ROW_HEIGHT_PX;

		try {
			target.setPointerCapture(event.pointerId);
		} catch {
			// happy-dom or browsers that lack support — ignore.
		}
		event.preventDefault();
	}

	function handlePointerMove(event: PointerEvent, id: string) {
		if (draggingId !== id || event.pointerId !== draggingPointerId) return;
		updateDragPreview(event.clientY);
		event.preventDefault();
	}

	function handlePointerUp(event: PointerEvent, id: string) {
		if (draggingId !== id || event.pointerId !== draggingPointerId) return;
		const target = computeTargetIndex(event.clientY);
		const base = dragBaseIndex;
		resetDrag();
		releaseCapture(event.currentTarget as Element, event.pointerId);
		if (target !== base) {
			onReorderLayer(id, target);
		}
	}

	function handlePointerCancel(event: PointerEvent, id: string) {
		if (draggingId !== id || event.pointerId !== draggingPointerId) return;
		resetDrag();
		releaseCapture(event.currentTarget as Element, event.pointerId);
	}

	// === Frame ruler reorder (horizontal drag) ============================
	// Parallels the layer-row drag above, but on the X axis. Frames are uniform
	// (no Pixel/Reference split), so every cell is reorderable and the clamp is
	// the full [0, frames.length - 1] range. The ruler cell doubles as the
	// select-on-click target, so a completed drag must explicitly swallow the
	// click it would otherwise emit.
	const DEFAULT_FRAME_COL_WIDTH_PX = 32;
	// Pointer travel below this is treated as a tap (select), not a drag (reorder).
	const FRAME_DRAG_THRESHOLD_PX = 4;

	let frameDraggingId = $state<string | null>(null);
	let frameDraggingPointerId = $state<number | null>(null);
	let frameDragStartX = $state(0);
	let frameDragBaseIndex = $state(0);
	let frameDragTargetIndex = $state<number | null>(null);
	let frameDragOffsetX = $state(0);
	let frameColWidth = $state(DEFAULT_FRAME_COL_WIDTH_PX);
	// Transient, non-reactive: set when a drag crosses the threshold so the
	// trailing click selects nothing. Cleared at the next pointerdown so a stale
	// flag (a browser that suppressed the post-drag click) can't poison the next
	// genuine click.
	let shouldSuppressNextFrameClick = false;

	const canReorderFrames = $derived(frames.length > 1);

	function computeFrameTargetIndex(clientX: number): number {
		const deltaX = clientX - frameDragStartX;
		const offset = Math.round(deltaX / frameColWidth);
		const candidate = frameDragBaseIndex + offset;
		return Math.max(0, Math.min(frames.length - 1, candidate));
	}

	function clampFrameDragOffsetX(clientX: number): number {
		const deltaX = clientX - frameDragStartX;
		const minOffset = -frameDragBaseIndex * frameColWidth;
		const maxOffset = (frames.length - 1 - frameDragBaseIndex) * frameColWidth;
		return Math.max(minOffset, Math.min(maxOffset, deltaX));
	}

	function frameDragTranslateX(id: string, index: number): number {
		if (frameDraggingId === null || frameDragTargetIndex === null) return 0;
		if (id === frameDraggingId) return frameDragOffsetX;
		if (frameDragBaseIndex < frameDragTargetIndex) {
			return index > frameDragBaseIndex && index <= frameDragTargetIndex ? -frameColWidth : 0;
		}
		if (frameDragBaseIndex > frameDragTargetIndex) {
			return index >= frameDragTargetIndex && index < frameDragBaseIndex ? frameColWidth : 0;
		}
		return 0;
	}

	function frameDragStyle(offsetX: number): string | undefined {
		return offsetX === 0 ? undefined : `--frame-drag-x: ${offsetX}px;`;
	}

	function resetFrameDrag() {
		frameDraggingId = null;
		frameDraggingPointerId = null;
		frameDragTargetIndex = null;
		frameDragOffsetX = 0;
	}

	function handleFramePointerDown(event: PointerEvent, id: string, index: number) {
		// A second pointer mid-drag must not hijack the gesture.
		if (frameDraggingId !== null) return;
		if (event.button !== 0) return;
		// Fresh interaction — clear suppression left by any prior drag.
		shouldSuppressNextFrameClick = false;
		if (!canReorderFrames) return;

		const target = event.currentTarget as HTMLElement;
		const measured = target.offsetWidth;

		frameDraggingId = id;
		frameDraggingPointerId = event.pointerId;
		frameDragStartX = event.clientX;
		frameDragBaseIndex = index;
		frameDragTargetIndex = index;
		frameDragOffsetX = 0;
		frameColWidth = measured > 0 ? measured : DEFAULT_FRAME_COL_WIDTH_PX;

		try {
			target.setPointerCapture(event.pointerId);
		} catch {
			// happy-dom or browsers that lack support — ignore.
		}
	}

	function handleFramePointerMove(event: PointerEvent, id: string) {
		if (frameDraggingId !== id || event.pointerId !== frameDraggingPointerId) return;
		if (Math.abs(event.clientX - frameDragStartX) > FRAME_DRAG_THRESHOLD_PX) {
			shouldSuppressNextFrameClick = true;
		}
		frameDragOffsetX = clampFrameDragOffsetX(event.clientX);
		frameDragTargetIndex = computeFrameTargetIndex(event.clientX);
		event.preventDefault();
	}

	function handleFramePointerUp(event: PointerEvent, id: string) {
		if (frameDraggingId !== id || event.pointerId !== frameDraggingPointerId) return;
		const target = computeFrameTargetIndex(event.clientX);
		const base = frameDragBaseIndex;
		const wasDrag = shouldSuppressNextFrameClick;
		resetFrameDrag();
		releaseCapture(event.currentTarget as Element, event.pointerId);
		if (wasDrag && target !== base) {
			onReorderFrame(id, target);
		}
	}

	function handleFramePointerCancel(event: PointerEvent, id: string) {
		if (frameDraggingId !== id || event.pointerId !== frameDraggingPointerId) return;
		resetFrameDrag();
		releaseCapture(event.currentTarget as Element, event.pointerId);
	}

	function handleFrameSelectClick(event: MouseEvent, id: string) {
		// A completed drag arms the suppress flag; swallow only the *pointer* click
		// that trails it (detail > 0). Keyboard activation (Enter/Space emits a click
		// with detail 0) must always select, so a stale flag can never block it.
		const suppress = shouldSuppressNextFrameClick && event.detail > 0;
		shouldSuppressNextFrameClick = false;
		if (suppress) return;
		onSelectFrame(id);
	}

	// === Active-frame duration editor (top-left corner) ===================
	// Commits the draft on Enter / blur so one retime is one undo step (the 196
	// coalescing contract). The clamp lives only at the WASM boundary, so the view
	// dispatches the raw value; after the round-trip it reconciles the field to the
	// stored truth, which snaps an out-of-range entry back to the clamped bound.
	// Duration is integer ms, so empty / non-numeric / fractional entries are
	// rejected here (`Number.isInteger` also rules out NaN and Infinity) rather than
	// dispatched to be silently truncated at the u32 boundary.
	async function commitFrameDuration() {
		const trimmed = durationDraft.trim();
		const parsed = Number(trimmed);
		if (trimmed !== '' && Number.isInteger(parsed) && parsed !== activeFrameDurationMs) {
			onSetFrameDuration(activeFrameId, parsed);
			// Let the dispatch round-trip through the projection before reconciling,
			// so the field reflects the clamped, stored value — even when the clamp
			// lands back on the current duration (where the sync effect wouldn't fire).
			await tick();
		}
		// Reverts an empty/invalid/unchanged field; snaps a clamped entry to its bound.
		durationDraft = String(activeFrameDurationMs);
	}

	function handleFrameDurationKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			// Commit in place; forcing a blur here would fire a second, stale commit.
			event.preventDefault();
			commitFrameDuration();
		} else if (event.key === 'Escape') {
			// Discard the in-progress edit and restore the stored value.
			event.preventDefault();
			durationDraft = String(activeFrameDurationMs);
			(event.currentTarget as HTMLInputElement).blur();
		}
	}
</script>

<section
	class="timeline-panel"
	class:timeline-panel--collapsed={collapsed}
	aria-label={m.layer_panel_title()}
	data-collapsed={collapsed ? 'true' : 'false'}
>
	<div class="header">
		<!-- Collapsed is a read-only summary strip (187 spec §4): only the summary
		     and the collapse chevron remain; the add actions are hidden. -->
		{#if !collapsed}
			<button
				type="button"
				class="add-btn"
				data-add-layer
				aria-label={m.aria_addLayer()}
				onclick={onAddLayer}
			>
				+
			</button>
			<button
				type="button"
				class="add-btn"
				data-add-reference-layer
				data-busy={isReferenceLayerImporting ? 'true' : 'false'}
				aria-label={m.aria_setReferenceLayer()}
				disabled={isReferenceLayerImporting}
				onclick={onAddReferenceLayer}
			>
				{#if isReferenceLayerImporting}
					<span class="spinner">
						<LoaderCircle size={14} strokeWidth={1.75} aria-hidden="true" />
					</span>
				{:else}
					<Image size={14} strokeWidth={1.75} aria-hidden="true" />
				{/if}
			</button>
		{/if}
		<span class="header-label">
			{collapsed
				? m.timeline_collapsed_summary({
						layer: activeLayerName,
						frame: activeFrameOrdinal,
						total: frames.length,
						duration: activeFrameDurationMs
					})
				: m.layer_panel_title()}
		</span>
		<!-- Header-right frame-action group, acting on the active frame (187 spec §3).
		     The `Frames` label mirrors the left `Layers` label, disambiguating the two
		     `+` buttons (left adds a layer, right adds a frame). Hidden when collapsed,
		     like the left add actions, so the strip stays read-only. -->
		{#if !collapsed}
			<span class="frames-label" data-frames-label>{m.timeline_frames_label()}</span>
			<button
				type="button"
				class="add-btn"
				data-add-frame
				aria-label={m.aria_addFrame()}
				onclick={onAddFrame}
			>
				+
			</button>
			<button
				type="button"
				class="add-btn"
				data-duplicate-frame
				aria-label={m.aria_duplicateFrame()}
				onclick={onDuplicateFrame}
			>
				<Copy size={14} strokeWidth={1.75} aria-hidden="true" />
			</button>
			<!-- Delete targets the active frame; disabled at one frame so the Document
			     is never left frameless (the core rejects it too — this just hides the
			     dead affordance). -->
			<button
				type="button"
				class="add-btn"
				data-remove-frame
				aria-label={m.aria_removeFrame()}
				disabled={frames.length === 1}
				onclick={() => onRemoveFrame(activeFrameId)}
			>
				<Trash2 size={14} strokeWidth={1.75} aria-hidden="true" />
			</button>
		{/if}
		<button
			type="button"
			class="collapse-toggle"
			data-collapse-toggle
			aria-label={collapsed ? m.aria_expandTimelinePanel() : m.aria_collapseTimelinePanel()}
			aria-expanded={!collapsed}
			onclick={onToggleCollapsed}
		>
			<ChevronDown size={14} aria-hidden="true" />
		</button>
	</div>
	{#if !collapsed}
		<div class="divider"></div>
		<!-- Transport strip (200 design): a full-width fixed bar between the header
		     and the [duration-corner | ruler] band. It never scrolls with the frames.
		     The ▾ playhead marker lives below, in the frame grid, aligned to columns. -->
		<TransportBar
			{isPlaying}
			{isLooping}
			position={transportPosition}
			frameCount={frames.length}
			{onTogglePlay}
			{onToggleLoop}
		/>
		<div class="body">
			<div class="sidebar">
				<!-- Reserves the playhead-marker lane's height so the duration corner
				     stays aligned with the ruler (the marker lane sits above the ruler
				     in the frame grid). -->
				<div class="playhead-lane-spacer" aria-hidden="true"></div>
				<!-- The top-left corner doubles as the active frame's duration editor
				     (194 design): aligned with the ruler, it edits whichever frame is
				     selected. The fps helper is read-only and desktop-only. -->
				<div class="sidebar-grid-header">
					<input
						type="text"
						inputmode="numeric"
						class="frame-duration-input"
						data-frame-duration-input
						aria-label={m.aria_frameDuration()}
						bind:value={durationDraft}
						onkeydown={handleFrameDurationKeydown}
						onblur={commitFrameDuration}
					/>
					<span class="frame-duration-unit" aria-hidden="true">ms</span>
					<span class="frame-duration-fps" data-frame-duration-fps aria-hidden="true">
						{activeFrameFps} fps
					</span>
				</div>
				{#each renderedLayers as layer, visualIndex (layer.id)}
					{@const isActive = layer.id === activeLayerId}
					{@const isVisible = layer.visible ?? true}
					{@const kind = layer.kind}
					{@const rowDragY = dragTranslateY(layer.id, visualIndex)}
					{@const isDraggingLayer = draggingId === layer.id}
					{@const isDragTarget =
						dragTargetIndex !== null &&
						dragTargetIndex !== dragBaseIndex &&
						dragTargetIndex === visualIndex}
					<div
						class="row"
						class:row--active={isActive}
						class:row--hidden={!isVisible}
						class:row--reference={kind === 'reference'}
						class:row--dragging={isDraggingLayer}
						class:row--drag-shifted={rowDragY !== 0 && !isDraggingLayer}
						style={dragStyle(rowDragY)}
						role="button"
						tabindex="0"
						data-layer-row
						data-layer-id={layer.id}
						data-dragging={isDraggingLayer ? 'true' : undefined}
						data-drag-target={isDragTarget ? 'true' : undefined}
						aria-current={isActive ? 'true' : undefined}
						onclick={() => onActivateLayer(layer.id)}
						onkeydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								onActivateLayer(layer.id);
							}
						}}
					>
						<button
							type="button"
							class="visibility-toggle"
							data-visibility-toggle
							aria-label={isVisible
								? m.aria_hideLayer({ name: layer.name })
								: m.aria_showLayer({ name: layer.name })}
							onkeydown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.stopPropagation();
								}
							}}
							onclick={(e) => {
								e.stopPropagation();
								onToggleLayerVisibility(layer.id, !isVisible);
							}}
						>
							{isVisible ? '◉' : '◎'}
						</button>
						<span class="bar"></span>
						<span
							class="kind-icon"
							data-layer-kind-icon
							data-layer-kind={kind}
							role="img"
							aria-label={kind === 'reference' ? m.layer_kind_reference() : m.layer_kind_pixel()}
						>
							{#if kind === 'reference'}
								<Image size={14} strokeWidth={1.75} aria-hidden="true" />
							{:else}
								<Grid2x2 size={14} strokeWidth={1.75} aria-hidden="true" />
							{/if}
						</span>
						<span class="name">{layer.name}</span>
						{#if kind === 'reference' && isActive}
							<button
								type="button"
								class="fit-canvas-btn"
								data-fit-reference-layer-to-canvas
								aria-label={m.aria_fitReferenceLayerToCanvas({ name: layer.name })}
								onkeydown={(e) => {
									if (e.key === 'Enter' || e.key === ' ') {
										e.stopPropagation();
									}
								}}
								onclick={(e) => {
									e.stopPropagation();
									onFitReferenceLayerToCanvas(layer.id);
								}}
							>
								<Maximize2 size={14} strokeWidth={1.75} aria-hidden="true" />
							</button>
						{/if}
						<button
							type="button"
							class="remove-btn"
							data-remove-layer
							aria-label={m.aria_removeLayer({ name: layer.name })}
							disabled={layers.length === 1}
							onkeydown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.stopPropagation();
								}
							}}
							onclick={(e) => {
								e.stopPropagation();
								onRemoveLayer(layer.id);
							}}
						>
							✕
						</button>
						{#if kind === 'pixel'}
							<button
								type="button"
								class="reorder-handle"
								data-reorder-handle
								aria-label={m.aria_reorderLayer({ name: layer.name })}
								disabled={!canReorderPixels}
								onclick={(e) => e.stopPropagation()}
								onkeydown={(e) => handleReorderKey(e, layer.id, visualIndex)}
								onpointerdown={(e) => handlePointerDown(e, layer.id, visualIndex)}
								onpointermove={(e) => handlePointerMove(e, layer.id)}
								onpointerup={(e) => handlePointerUp(e, layer.id)}
								onpointercancel={(e) => handlePointerCancel(e, layer.id)}
							>
								≡
							</button>
						{/if}
					</div>
				{/each}
				{#if isReferenceLayerImporting}
					<div
						class="row row--busy"
						data-reference-layer-import-row
						aria-busy="true"
						aria-live="polite"
					>
						<span class="visibility-placeholder"></span>
						<span class="bar"></span>
						<span class="kind-icon" role="img" aria-label={m.layer_kind_reference()}>
							<span class="spinner">
								<LoaderCircle size={14} strokeWidth={1.75} aria-hidden="true" />
							</span>
						</span>
						<span class="name">{busyReferenceName}</span>
					</div>
				{/if}
			</div>
			<div class="vdiv"></div>
			<div class="frame-area">
				<div class="frame-grid">
					<!-- Playhead marker lane (200 design): a thin row above the ruler,
					     one cell per frame column. The ▾ marker sweeps to the Playhead
					     frame while playing — a channel kept separate from the static
					     Active-Frame highlight on the ruler, so the two never collide. -->
					<div class="playhead-lane" data-playhead-lane aria-hidden="true">
						{#each frames as frameCol (frameCol.id)}
							{@const isPlayheadCell = isPlaying && frameCol.id === playheadFrameId}
							<div class="playhead-cell">
								{#if isPlayheadCell}
									<span
										class="playhead-marker"
										data-playhead-marker
										data-playhead-frame-id={frameCol.id}
										data-playhead-ordinal={playheadOrdinal}
									>▼</span>
								{/if}
							</div>
						{/each}
					</div>
					<div class="frame-ruler">
						{#each frames as frameCol, frameIndex (frameCol.id)}
							{@const isActiveFrame = frameCol.id === activeFrameId}
							{@const cellDragX = frameDragTranslateX(frameCol.id, frameIndex)}
							{@const isDraggingFrame = frameDraggingId === frameCol.id}
							{@const isFrameDragTarget =
								frameDragTargetIndex !== null &&
								frameDragTargetIndex !== frameDragBaseIndex &&
								frameDragTargetIndex === frameIndex}
							<button
								type="button"
								class="frame-ruler-cell"
								class:frame-ruler-cell--active={isActiveFrame}
								class:frame-ruler-cell--dragging={isDraggingFrame}
								class:frame-ruler-cell--drag-shifted={cellDragX !== 0 && !isDraggingFrame}
								style={frameDragStyle(cellDragX)}
								data-frame-ruler-cell
								data-frame-id={frameCol.id}
								data-frame-dragging={isDraggingFrame ? 'true' : undefined}
								data-frame-drag-target={isFrameDragTarget ? 'true' : undefined}
								aria-current={isActiveFrame ? 'true' : undefined}
								aria-label={m.aria_selectFrame({ n: frameIndex + 1 })}
								onclick={(e) => handleFrameSelectClick(e, frameCol.id)}
								onpointerdown={(e) => handleFramePointerDown(e, frameCol.id, frameIndex)}
								onpointermove={(e) => handleFramePointerMove(e, frameCol.id)}
								onpointerup={(e) => handleFramePointerUp(e, frameCol.id)}
								onpointercancel={(e) => handleFramePointerCancel(e, frameCol.id)}
							>
								{frameIndex + 1}
							</button>
						{/each}
					</div>
					<div class="frame-body">
						{#each renderedLayers as layer, visualIndex (layer.id)}
							{#if layer.kind === 'pixel'}
								{@const rowDragY = dragTranslateY(layer.id, visualIndex)}
								<div
									class="frame-row"
									class:frame-row--active-layer={layer.id === activeLayerId}
									class:frame-row--dragging={draggingId === layer.id}
									class:frame-row--drag-shifted={rowDragY !== 0 && draggingId !== layer.id}
									style={dragStyle(rowDragY)}
									data-frame-row
									data-layer-id={layer.id}
								>
									{#each frames as frameCol, frameIndex (frameCol.id)}
										{@const isActiveFrame = frameCol.id === activeFrameId}
										{@const isActiveCel = isActiveFrame && layer.id === activeLayerId}
										<button
											type="button"
											class="frame-cell"
											class:frame-cell--frame-active={isActiveFrame}
											class:frame-cell--cel-active={isActiveCel}
											data-frame-cell
											data-layer-id={layer.id}
											data-frame-id={frameCol.id}
											data-frame-active={isActiveFrame ? 'true' : undefined}
											data-cel-active={isActiveCel ? 'true' : undefined}
											aria-label={m.aria_selectCel({ layer: layer.name, n: frameIndex + 1 })}
											onclick={() => onSelectCel(layer.id, frameCol.id)}
										>
											{#if frameCol.occupiedLayerIds.has(layer.id)}
												<span class="cel-dot" data-cel-dot></span>
											{/if}
										</button>
									{/each}
								</div>
							{:else}
								<div class="frame-reference-row" data-frame-row data-layer-id={layer.id}>
									<div class="frame-reference-span" data-frame-reference-span>
										<span class="frame-reference-icon" aria-hidden="true">
											<Image size={14} strokeWidth={1.75} />
										</span>
										<span class="frame-reference-caption">
											{m.timeline_reference_span_caption()}
										</span>
									</div>
								</div>
							{/if}
						{/each}
						{#if isReferenceLayerImporting}
							<!-- Placeholder band keeping the frame grid aligned with the
							     sidebar's busy Reference import row. -->
							<div class="frame-reference-row" aria-hidden="true">
								<div class="frame-reference-span"></div>
							</div>
						{/if}
					</div>
				</div>
			</div>
		</div>
	{/if}
</section>

<style>
	.timeline-panel {
		--row-height: 32px;
		/* Grew from 180px to seat the transport bar (200 design) + the playhead
		   marker lane above the ruler, keeping a comparable number of frame rows. */
		--panel-height: 224px;
		--sidebar-width: 256px;
		/* Frame columns are square — width tracks the shared row height so each
		   sidebar layer row aligns with its frame grid row. */
		--frame-col-width: var(--row-height);
		--ruler-height: 24px;
		/* The thin row above the ruler that carries the ▾ playhead marker. The
		   sidebar reserves the same height so the duration corner stays ruler-aligned. */
		--playhead-lane-height: 14px;
		--cel-dot-size: 6px;

		display: flex;
		flex-direction: column;
		height: var(--panel-height);
		background: var(--ds-bg-surface);
		border: var(--ds-border-width) solid var(--ds-border-subtle);
		font-family: var(--ds-font-body);
		overflow: hidden;
	}

	.timeline-panel--collapsed {
		height: var(--row-height);
	}

	@media (max-width: 1023px) {
		.timeline-panel {
			/* Tab-takeover on touch (187 spec): 40px grid rows/cells and a narrower
			   sidebar so the scrollable frame area gets more room. The ruler (and the
			   duration corner aligned to it) grows to seat the touch-target-sized
			   duration input with breathing room (194 mobile spec). */
			--row-height: 40px;
			--panel-height: 288px;
			--sidebar-width: 140px;
			--ruler-height: 48px;
		}

		.frame-duration-input {
			height: var(--ds-touch-target-min);
			width: 64px;
			font-size: var(--ds-font-size-md);
		}

		/* The fps helper is desktop-only (194); the narrow mobile sidebar drops it. */
		.frame-duration-fps {
			display: none;
		}
	}

	.header {
		height: var(--row-height);
		display: flex;
		align-items: center;
		gap: var(--ds-space-2);
		padding: 0 var(--ds-space-2);
		flex: none;
	}

	.header-label {
		font-size: var(--ds-font-size-md);
		font-weight: 600;
		color: var(--ds-text-primary);
		/* Absorbs the free space between the left `Layers` group and the right
		   `Frames` group, pushing the frame actions (and collapse chevron) to the
		   far edge. Also drives the collapsed summary's chevron to the right. */
		margin-right: auto;
	}

	/* Prefixes the header-right frame-action group. Mirrors `.header-label`'s
	   weight/color (only labels are text-primary; action icons stay secondary) but
	   carries no auto margin — the left label already claimed the free space. */
	.frames-label {
		font-size: var(--ds-font-size-md);
		font-weight: 600;
		color: var(--ds-text-primary);
	}

	.add-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		padding: 0;
		border: none;
		background: none;
		border-radius: var(--ds-radius-sm);
		color: var(--ds-text-secondary);
		font-size: var(--ds-font-size-md);
		font-family: inherit;
		line-height: 1;
		cursor: pointer;
	}

	.add-btn:hover {
		background: var(--ds-bg-hover);
		color: var(--ds-text-primary);
	}

	.add-btn:focus-visible {
		outline: var(--ds-border-width-thick) solid var(--ds-accent);
		outline-offset: 1px;
	}

	.add-btn:disabled {
		opacity: 0.55;
		cursor: default;
	}

	.add-btn:disabled:hover {
		background: none;
		color: var(--ds-text-secondary);
	}

	.collapse-toggle {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		padding: 0;
		border: none;
		background: none;
		border-radius: var(--ds-radius-sm);
		color: var(--ds-text-secondary);
		font-size: var(--ds-font-size-md);
		font-family: inherit;
		line-height: 1;
		cursor: pointer;
		transition: transform 120ms ease;
	}

	.collapse-toggle:hover {
		background: var(--ds-bg-hover);
		color: var(--ds-text-primary);
	}

	.collapse-toggle:focus-visible {
		outline: var(--ds-border-width-thick) solid var(--ds-accent);
		outline-offset: 1px;
	}

	.timeline-panel--collapsed .collapse-toggle {
		transform: rotate(180deg);
	}

	@media (max-width: 1023px) {
		.collapse-toggle {
			display: none;
		}
	}

	.divider {
		height: var(--ds-border-width);
		background: var(--ds-border-subtle);
		flex: none;
	}

	.body {
		display: flex;
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		align-items: flex-start;
	}

	.sidebar {
		width: var(--sidebar-width);
		display: flex;
		flex-direction: column;
		flex: none;
	}

	.vdiv {
		width: var(--ds-border-width);
		background: var(--ds-border-subtle);
		flex: none;
		align-self: stretch;
	}

	.frame-area {
		flex: 1;
		min-width: 0;
		overflow-x: auto;
	}

	/* Reserves the marker-lane height above the duration corner so the corner stays
	   ruler-aligned. Elevated (unlike the transparent frame-side marker lane) so the
	   corner reads as one full-height elevated block — the 200 design's split where
	   the corner is solid and the playhead lane is surface-transparent. */
	.playhead-lane-spacer {
		height: var(--playhead-lane-height);
		flex: none;
		background: var(--ds-bg-elevated);
	}

	/* Aligns the sidebar's layer rows with the frame body rows by reserving the
	   ruler height at the top of the frozen sidebar. The bg-elevated fill matches
	   the ruler so corner + ruler read as one continuous top band. */
	.sidebar-grid-header {
		height: var(--ruler-height);
		flex: none;
		background: var(--ds-bg-elevated);
		display: flex;
		align-items: center;
		gap: var(--ds-space-1);
		padding: 0 var(--ds-space-2);
		box-sizing: border-box;
		overflow: hidden;
	}

	.frame-duration-input {
		width: 56px;
		height: 20px;
		flex: none;
		min-width: 0;
		padding: 0 var(--ds-space-1);
		box-sizing: border-box;
		border: var(--ds-border-width) solid var(--ds-border-subtle);
		border-radius: var(--ds-radius-sm);
		background: var(--ds-bg-surface);
		color: var(--ds-text-primary);
		font-family: inherit;
		font-size: var(--ds-font-size-xs);
		text-align: center;
	}

	.frame-duration-input:focus-visible {
		outline: var(--ds-border-width-thick) solid var(--ds-accent);
		outline-offset: 1px;
	}

	.frame-duration-unit {
		flex: none;
		font-size: var(--ds-font-size-xs);
		color: var(--ds-text-secondary);
	}

	.frame-duration-fps {
		flex: none;
		margin-left: auto;
		font-size: var(--ds-font-size-xs);
		color: var(--ds-text-tertiary);
		white-space: nowrap;
	}

	.frame-grid {
		display: flex;
		flex-direction: column;
		width: max-content;
		min-width: 100%;
	}

	/* Playhead marker lane: a thin row above the ruler, one cell per frame column
	   (same width), so the ▼ marker sits over the Playhead frame. Transparent (200
	   design) so it reads as the panel surface above the elevated ruler — the corner
	   side stays elevated via the spacer. Always reserved (even when stopped) so
	   starting/stopping playback never shifts the layout. */
	.playhead-lane {
		display: flex;
		height: var(--playhead-lane-height);
		flex: none;
	}

	.playhead-cell {
		width: var(--frame-col-width);
		height: var(--playhead-lane-height);
		flex: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	/* The marker is a per-cell glyph that appears in the Playhead column and jumps
	   column-to-column as the frame advances — instant content changes, so motion is
	   inherently reduced-motion-safe (no sliding transition to suppress). */
	.playhead-marker {
		color: var(--ds-accent);
		/* 1px above the ruler ordinals (--ds-font-size-xs), matching the 200 in-context
		   scale (marker 11 vs ordinal 10) — not the enlarged anatomy figure's 12. */
		font-size: var(--ds-font-size-sm);
		line-height: 1;
	}

	.frame-ruler {
		display: flex;
		height: var(--ruler-height);
		flex: none;
		background: var(--ds-bg-elevated);
	}

	.frame-ruler-cell {
		width: var(--frame-col-width);
		height: var(--ruler-height);
		flex: none;
		box-sizing: border-box;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		border: none;
		border-right: var(--ds-border-width) solid var(--ds-border-subtle);
		/* Reserve the 2px active top-bar slot up front so the ordinal never shifts
		   when a column becomes active. */
		border-top: var(--ds-border-width-thick) solid transparent;
		background: none;
		color: var(--ds-text-tertiary);
		font-family: inherit;
		font-size: var(--ds-font-size-xs);
		font-weight: 500;
		line-height: 1;
		cursor: pointer;
		/* The cell is a drag-reorder target; --frame-drag-x animates the preview
		   shift. position + touch-action let the dragged cell stack above its
		   neighbours and claim the touch gesture instead of scrolling the ruler. */
		position: relative;
		transform: translateX(var(--frame-drag-x, 0));
		transition: transform 120ms ease;
		touch-action: none;
	}

	.frame-ruler-cell:hover {
		background: var(--ds-bg-hover);
		color: var(--ds-text-primary);
	}

	.frame-ruler-cell:focus-visible {
		outline: var(--ds-border-width-thick) solid var(--ds-accent);
		outline-offset: -2px;
	}

	/* Two-channel active treatment (color-blind safe): channel 1 is the
	   accent-subtle fill, channel 2 is the 2px accent bar on the top edge — either
	   alone identifies the active frame without relying on hue. */
	.frame-ruler-cell--active {
		background: var(--ds-accent-subtle);
		border-top-color: var(--ds-accent);
		color: var(--ds-accent-text);
		font-weight: 700;
	}

	.frame-ruler-cell--dragging {
		z-index: 2;
		cursor: grabbing;
		background: var(--ds-bg-active);
		transition: none;
	}

	.frame-ruler-cell--drag-shifted {
		z-index: 1;
	}

	.frame-body {
		display: flex;
		flex-direction: column;
	}

	.frame-row {
		display: flex;
		height: var(--row-height);
		flex: none;
		transform: translateY(var(--layer-drag-y, 0));
		transition: transform 120ms ease;
	}

	/* Active-layer tint spans the grid row, mirroring the sidebar's .row--active so
	   the active layer reads continuously across both panes. */
	.frame-row--active-layer {
		background: var(--ds-bg-active);
	}

	.frame-row--dragging {
		position: relative;
		z-index: 2;
		transition: none;
	}

	.frame-row--drag-shifted {
		position: relative;
		z-index: 1;
	}

	.frame-cell {
		width: var(--frame-col-width);
		height: var(--row-height);
		flex: none;
		box-sizing: border-box;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		border: none;
		border-right: var(--ds-border-width) solid var(--ds-border-subtle);
		border-bottom: var(--ds-border-width) solid var(--ds-border-subtle);
		/* Transparent so the row tint shows through (bg-active on the active layer,
		   the panel surface otherwise); the active column overrides with
		   accent-subtle. */
		background: none;
		cursor: pointer;
	}

	.frame-cell:hover {
		background: var(--ds-bg-hover);
	}

	.frame-cell:focus-visible {
		outline: var(--ds-border-width-thick) solid var(--ds-accent);
		outline-offset: -2px;
	}

	.frame-cell--frame-active {
		background: var(--ds-accent-subtle);
	}

	/* The active cel (active layer ∩ active frame) adds an accent border over the
	   column's accent-subtle fill for combined emphasis. */
	.frame-cell--cel-active {
		box-shadow: inset 0 0 0 var(--ds-border-width) var(--ds-accent);
	}

	.cel-dot {
		width: var(--cel-dot-size);
		height: var(--cel-dot-size);
		border-radius: var(--ds-radius-full);
		background: var(--ds-text-secondary);
	}

	.frame-cell--cel-active .cel-dot {
		background: var(--ds-accent);
	}

	.frame-reference-row {
		display: flex;
		height: var(--row-height);
		flex: none;
		/* Pairs with the sidebar's .row--reference top border so the divider reads
		   as one line spanning both panes. Uses the stronger --ds-border (not subtle)
		   to separate the frame-independent underlay from the cel grid. */
		border-top: var(--ds-border-width) solid var(--ds-border);
		box-sizing: border-box;
	}

	.frame-reference-span {
		flex: 1;
		display: flex;
		align-items: center;
		gap: var(--ds-space-3);
		min-width: 0;
		padding: 0 var(--ds-space-3);
		/* A continuous muted band — deliberately not cell-divided — signals that the
		   Reference underlay is frame-independent. */
		background: var(--ds-bg-hover);
	}

	.frame-reference-icon {
		display: inline-flex;
		align-items: center;
		flex: none;
		color: var(--ds-accent-text);
	}

	.frame-reference-caption {
		font-size: var(--ds-font-size-xs);
		font-weight: 500;
		color: var(--ds-text-tertiary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.row {
		display: flex;
		align-items: center;
		height: var(--row-height);
		cursor: pointer;
		position: relative;
		transform: translateY(var(--layer-drag-y, 0));
		transition:
			transform 120ms ease,
			box-shadow 120ms ease,
			background-color 120ms ease;
	}

	.row:focus-visible {
		outline: var(--ds-border-width-thick) solid var(--ds-accent);
		outline-offset: -2px;
	}

	.row--active {
		background: var(--ds-bg-active);
	}

	/* Top divider mirrored by .frame-reference-row so the line spans both panes.
	   border-box keeps the bordered row the same height as its frame counterpart. */
	.row--reference {
		border-top: var(--ds-border-width) solid var(--ds-border);
		box-sizing: border-box;
	}

	.row--active .bar {
		background: var(--ds-accent);
	}

	.row--active .name {
		font-weight: 500;
	}

	.bar {
		width: var(--ds-border-width-thick);
		height: var(--row-height);
	}

	.kind-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		color: var(--ds-text-secondary);
		flex: none;
	}

	.row--active .kind-icon {
		color: var(--ds-text-primary);
	}

	.name {
		flex: 1;
		padding: 0 var(--ds-space-3);
		font-size: var(--ds-font-size-md);
		color: var(--ds-text-primary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.remove-btn,
	.reorder-handle,
	.visibility-toggle,
	.fit-canvas-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		padding: 0;
		border: none;
		background: none;
		border-radius: var(--ds-radius-sm);
		color: var(--ds-text-secondary);
		font-size: var(--ds-font-size-md);
		font-family: inherit;
		line-height: 1;
		cursor: pointer;
	}

	.remove-btn:hover:not(:disabled),
	.reorder-handle:hover:not(:disabled),
	.visibility-toggle:hover:not(:disabled),
	.fit-canvas-btn:hover:not(:disabled) {
		background: var(--ds-bg-hover);
		color: var(--ds-text-primary);
	}

	.remove-btn:focus-visible,
	.reorder-handle:focus-visible,
	.visibility-toggle:focus-visible,
	.fit-canvas-btn:focus-visible {
		outline: var(--ds-border-width-thick) solid var(--ds-accent);
		outline-offset: 1px;
	}

	.remove-btn:disabled,
	.reorder-handle:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}

	.visibility-toggle {
		margin-left: var(--ds-space-2);
	}

	.visibility-placeholder {
		width: 24px;
		height: 24px;
		margin-left: var(--ds-space-2);
		flex: none;
	}

	.row--hidden .name {
		opacity: 0.45;
		font-style: italic;
	}

	.row--hidden .kind-icon {
		opacity: 0.45;
	}

	.row--dragging {
		z-index: 2;
		cursor: grabbing;
		background: var(--ds-bg-active);
		box-shadow: 0 4px 14px rgb(0 0 0 / 0.18);
		transition: none;
	}

	.row--drag-shifted {
		z-index: 1;
	}

	.reorder-handle {
		margin-right: var(--ds-space-2);
		cursor: grab;
		touch-action: none;
	}

	.reorder-handle:active:not(:disabled) {
		cursor: grabbing;
	}

	.row--busy {
		cursor: default;
		color: var(--ds-text-secondary);
	}

	.row--busy .name {
		color: var(--ds-text-secondary);
	}

	.spinner {
		animation: spin 800ms linear infinite;
	}

	@media (prefers-reduced-motion: reduce) {
		.row,
		.frame-row,
		.frame-ruler-cell {
			transition: none;
		}

		.spinner {
			animation: none;
		}
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
