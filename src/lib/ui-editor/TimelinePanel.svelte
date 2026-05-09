<script lang="ts">
	interface LayerSummary {
		readonly id: string;
		readonly name: string;
	}

	interface Props {
		layers: ReadonlyArray<LayerSummary>;
		activeLayerId: string;
	}

	let { layers, activeLayerId }: Props = $props();
</script>

<section class="timeline-panel" aria-label="Layers">
	<div class="header">
		<span class="header-label">Layers</span>
	</div>
	<div class="divider"></div>
	<div class="body">
		<div class="sidebar">
			{#each layers as layer (layer.id)}
				{@const isActive = layer.id === activeLayerId}
				<div
					class="row"
					class:row--active={isActive}
					data-layer-row
					data-layer-id={layer.id}
					aria-current={isActive ? 'true' : undefined}
				>
					<span class="bar"></span>
					<span class="name">{layer.name}</span>
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
		padding: 0 var(--ds-space-2);
		flex: none;
	}

	.header-label {
		font-size: var(--ds-font-size-md);
		font-weight: 600;
		padding: 0 var(--ds-space-3);
		color: var(--ds-text-primary);
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
	}

	.sidebar {
		width: var(--sidebar-width);
		display: flex;
		flex-direction: column;
		overflow-y: auto;
		flex: none;
	}

	.vdiv {
		width: var(--ds-border-width);
		background: var(--ds-border-subtle);
		flex: none;
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
</style>
