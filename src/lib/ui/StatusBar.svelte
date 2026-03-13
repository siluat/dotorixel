<script lang="ts">
	import type { ToolType } from '$lib/canvas/tool';
	import PixelPanel from './PixelPanel.svelte';

	interface Props {
		canvasWidth: number;
		canvasHeight: number;
		zoomPercent: number;
		activeTool: ToolType;
	}

	let { canvasWidth, canvasHeight, zoomPercent, activeTool }: Props = $props();

	const TOOL_LABELS: Record<ToolType, string> = {
		pencil: 'Pencil',
		eraser: 'Eraser'
	};
</script>

<PixelPanel style="padding: var(--space-1) var(--space-3)">
	<div class="status-bar">
		<div class="status-left">
			<span class="status-value">{canvasWidth} × {canvasHeight}</span>
			<span class="separator"></span>
			<span class="status-value">{zoomPercent}%</span>
		</div>
		<div class="status-right">
			<span class="status-label">Tool:</span>
			<span class="tool-name">{TOOL_LABELS[activeTool]}</span>
		</div>
	</div>
</PixelPanel>

<style>
	.status-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-family: var(--font-mono);
		font-size: 11px;
	}

	.status-left {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.status-right {
		display: flex;
		align-items: center;
		gap: var(--space-1);
	}

	.status-value {
		color: var(--color-muted-fg);
		font-variant-numeric: tabular-nums;
	}

	.separator {
		width: var(--border-width);
		height: var(--space-4);
		background: var(--color-border);
	}

	.status-label {
		color: var(--color-muted-fg);
	}

	.tool-name {
		color: var(--color-surface-fg);
		text-transform: uppercase;
	}
</style>
