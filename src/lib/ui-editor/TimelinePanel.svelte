<script lang="ts">
	import { ChevronDown, Grid2x2, Image, LoaderCircle, Maximize2 } from 'lucide-svelte';
	import * as m from '$lib/paraglide/messages';

	type LayerKind = 'pixel' | 'reference';

	interface LayerSummary {
		readonly id: string;
		readonly name: string;
		readonly visible?: boolean;
		readonly kind: LayerKind;
	}

	interface Props {
		layers: ReadonlyArray<LayerSummary>;
		activeLayerId: string;
		collapsed: boolean;
		onAddLayer: () => void;
		onAddReferenceLayer: () => void;
		onActivateLayer: (id: string) => void;
		onRemoveLayer: (id: string) => void;
		onReorderLayer: (id: string, newVisualIndex: number) => void;
		onToggleLayerVisibility: (id: string, newVisible: boolean) => void;
		onToggleCollapsed: () => void;
		onFitReferenceLayerToCanvas: (id: string) => void;
		isReferenceLayerImporting?: boolean;
		referenceLayerImportName?: string;
	}

	let {
		layers,
		activeLayerId,
		collapsed,
		onAddLayer,
		onAddReferenceLayer,
		onActivateLayer,
		onRemoveLayer,
		onReorderLayer,
		onToggleLayerVisibility,
		onToggleCollapsed,
		onFitReferenceLayerToCanvas,
		isReferenceLayerImporting = false,
		referenceLayerImportName
	}: Props = $props();

	// Fallback row height used when the DOM has no layout (e.g. headless test
	// environments where offsetHeight is 0). Matches the docked-mode --row-height.
	const DEFAULT_ROW_HEIGHT_PX = 32;

	const activeLayerName = $derived(
		layers.find((l) => l.id === activeLayerId)?.name ?? ''
	);
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
</script>

<section
	class="timeline-panel"
	class:timeline-panel--collapsed={collapsed}
	aria-label={m.layer_panel_title()}
	data-collapsed={collapsed ? 'true' : 'false'}
>
	<div class="header">
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
		<span class="header-label">
			{collapsed ? m.layer_panel_collapsed_label({ name: activeLayerName }) : m.layer_panel_title()}
		</span>
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
		<div class="body">
			<div class="sidebar">
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
				<div class="frame-col">
					{#each renderedLayers as layer, visualIndex (layer.id)}
						{@const cellDragY = dragTranslateY(layer.id, visualIndex)}
						<div
							class="frame-cell"
							class:frame-cell--dragging={draggingId === layer.id}
							class:frame-cell--drag-shifted={cellDragY !== 0 && draggingId !== layer.id}
							style={dragStyle(cellDragY)}
						></div>
					{/each}
					{#if isReferenceLayerImporting}
						<div class="frame-cell"></div>
					{/if}
				</div>
				<div class="empty-axis">
					<span class="empty-axis-hint">M3 placeholder — frame ruler grows here in M4</span>
				</div>
			</div>
		</div>
	{/if}
</section>

<style>
	.timeline-panel {
		--row-height: 32px;
		--panel-height: 180px;
		--sidebar-width: 256px;

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
			--row-height: 28px;
			--panel-height: 146px;
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
		margin-left: auto;
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
		display: flex;
		min-width: 0;
	}

	.frame-col {
		width: var(--row-height);
		display: flex;
		flex-direction: column;
		flex: none;
	}

	.frame-cell {
		width: var(--row-height);
		height: var(--row-height);
		background: var(--ds-bg-base);
		border: var(--ds-border-width) solid var(--ds-border-subtle);
		box-sizing: border-box;
		transform: translateY(var(--layer-drag-y, 0));
		transition: transform 120ms ease;
	}

	.frame-cell--dragging {
		position: relative;
		z-index: 2;
		transition: none;
	}

	.frame-cell--drag-shifted {
		position: relative;
		z-index: 1;
	}

	.empty-axis {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 0;
		padding: 0 var(--ds-space-5);
	}

	.empty-axis-hint {
		font-size: var(--ds-font-size-sm);
		font-style: italic;
		color: var(--ds-text-tertiary);
		text-align: center;
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
		.frame-cell {
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
