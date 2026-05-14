<script lang="ts">
	import { ChevronDown } from 'lucide-svelte';
	import * as m from '$lib/paraglide/messages';

	interface LayerSummary {
		readonly id: string;
		readonly name: string;
		readonly visible?: boolean;
	}

	interface Props {
		layers: ReadonlyArray<LayerSummary>;
		activeLayerId: string;
		onAddLayer: () => void;
		onActivateLayer: (id: string) => void;
		onRemoveLayer: (id: string) => void;
		onReorderLayer: (id: string, newVisualIndex: number) => void;
		onToggleLayerVisibility: (id: string, newVisible: boolean) => void;
	}

	let {
		layers,
		activeLayerId,
		onAddLayer,
		onActivateLayer,
		onRemoveLayer,
		onReorderLayer,
		onToggleLayerVisibility
	}: Props = $props();

	// Fallback row height used when the DOM has no layout (e.g. headless test
	// environments where offsetHeight is 0). Matches the docked-mode --row-height.
	const DEFAULT_ROW_HEIGHT_PX = 32;

	let isCollapsed = $state(false);

	const activeLayerName = $derived(
		layers.find((l) => l.id === activeLayerId)?.name ?? ''
	);

	let draggingId: string | null = null;
	let draggingPointerId: number | null = null;
	let dragStartY = 0;
	let dragBaseIndex = 0;
	let dragRowHeight = DEFAULT_ROW_HEIGHT_PX;

	function handleReorderKey(event: KeyboardEvent, id: string, visualIndex: number) {
		if (event.key === 'ArrowUp') {
			event.preventDefault();
			if (visualIndex > 0) onReorderLayer(id, visualIndex - 1);
		} else if (event.key === 'ArrowDown') {
			event.preventDefault();
			if (visualIndex < layers.length - 1) onReorderLayer(id, visualIndex + 1);
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
		return Math.max(0, Math.min(layers.length - 1, candidate));
	}

	function handlePointerDown(event: PointerEvent, id: string, visualIndex: number) {
		// Ignore secondary pointers (e.g. a second finger on a multi-touch device)
		// while a drag is in progress — only the initiating pointer drives it.
		if (draggingId !== null) return;
		if (layers.length < 2) return;
		if (event.button !== 0) return;
		const target = event.currentTarget as HTMLElement;
		const row = target.closest('[data-layer-row]') as HTMLElement | null;
		const measured = row?.offsetHeight ?? 0;

		draggingId = id;
		draggingPointerId = event.pointerId;
		dragStartY = event.clientY;
		dragBaseIndex = visualIndex;
		dragRowHeight = measured > 0 ? measured : DEFAULT_ROW_HEIGHT_PX;

		try {
			target.setPointerCapture(event.pointerId);
		} catch {
			// happy-dom or browsers that lack support — ignore.
		}
		event.preventDefault();
	}

	function handlePointerUp(event: PointerEvent, id: string) {
		if (draggingId !== id || event.pointerId !== draggingPointerId) return;
		const target = computeTargetIndex(event.clientY);
		const base = dragBaseIndex;
		draggingId = null;
		draggingPointerId = null;
		releaseCapture(event.currentTarget as Element, event.pointerId);
		if (target !== base) {
			onReorderLayer(id, target);
		}
	}

	function handlePointerCancel(event: PointerEvent, id: string) {
		if (draggingId !== id || event.pointerId !== draggingPointerId) return;
		draggingId = null;
		draggingPointerId = null;
		releaseCapture(event.currentTarget as Element, event.pointerId);
	}
</script>

<section
	class="timeline-panel"
	class:timeline-panel--collapsed={isCollapsed}
	aria-label={m.layer_panel_title()}
	data-collapsed={isCollapsed ? 'true' : 'false'}
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
		<span class="header-label">
			{isCollapsed ? m.layer_panel_collapsed_label({ name: activeLayerName }) : m.layer_panel_title()}
		</span>
		<button
			type="button"
			class="collapse-toggle"
			data-collapse-toggle
			aria-label={isCollapsed ? m.aria_expandTimelinePanel() : m.aria_collapseTimelinePanel()}
			onclick={() => (isCollapsed = !isCollapsed)}
		>
			<ChevronDown size={14} aria-hidden="true" />
		</button>
	</div>
	{#if !isCollapsed}
		<div class="divider"></div>
		<div class="body">
			<div class="sidebar">
				{#each layers as layer, visualIndex (layer.id)}
					{@const isActive = layer.id === activeLayerId}
					{@const isVisible = layer.visible ?? true}
					<div
						class="row"
						class:row--active={isActive}
						class:row--hidden={!isVisible}
						role="button"
						tabindex="0"
						data-layer-row
						data-layer-id={layer.id}
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
						<span class="name">{layer.name}</span>
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
						<button
							type="button"
							class="reorder-handle"
							data-reorder-handle
							aria-label={m.aria_reorderLayer({ name: layer.name })}
							disabled={layers.length === 1}
							onclick={(e) => e.stopPropagation()}
							onkeydown={(e) => handleReorderKey(e, layer.id, visualIndex)}
							onpointerdown={(e) => handlePointerDown(e, layer.id, visualIndex)}
							onpointerup={(e) => handlePointerUp(e, layer.id)}
							onpointercancel={(e) => handlePointerCancel(e, layer.id)}
						>
							≡
						</button>
					</div>
				{/each}
			</div>
			<div class="vdiv"></div>
			<div class="frame-area">
				<div class="frame-col">
					{#each layers as layer (layer.id)}
						<div class="frame-cell"></div>
					{/each}
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
	.visibility-toggle {
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
	.visibility-toggle:hover:not(:disabled) {
		background: var(--ds-bg-hover);
		color: var(--ds-text-primary);
	}

	.remove-btn:focus-visible,
	.reorder-handle:focus-visible,
	.visibility-toggle:focus-visible {
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

	.row--hidden .name {
		opacity: 0.45;
		font-style: italic;
	}

	.reorder-handle {
		margin-right: var(--ds-space-2);
		cursor: grab;
		touch-action: none;
	}

	.reorder-handle:active:not(:disabled) {
		cursor: grabbing;
	}
</style>
