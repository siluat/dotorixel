<script lang="ts">
	import * as m from '$lib/paraglide/messages';

	interface LayerSummary {
		readonly id: string;
		readonly name: string;
	}

	interface Props {
		layers: ReadonlyArray<LayerSummary>;
		activeLayerId: string;
		onAddLayer: () => void;
		onActivateLayer: (id: string) => void;
		onRemoveLayer: (id: string) => void;
	}

	let { layers, activeLayerId, onAddLayer, onActivateLayer, onRemoveLayer }: Props = $props();
</script>

<section class="timeline-panel" aria-label={m.layer_panel_title()}>
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
		<span class="header-label">{m.layer_panel_title()}</span>
	</div>
	<div class="divider"></div>
	<div class="body">
		<div class="sidebar">
			{#each layers as layer (layer.id)}
				{@const isActive = layer.id === activeLayerId}
				<div
					class="row"
					class:row--active={isActive}
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

	.remove-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		margin-right: var(--ds-space-2);
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

	.remove-btn:hover:not(:disabled) {
		background: var(--ds-bg-hover);
		color: var(--ds-text-primary);
	}

	.remove-btn:focus-visible {
		outline: var(--ds-border-width-thick) solid var(--ds-accent);
		outline-offset: 1px;
	}

	.remove-btn:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}
</style>
