<script lang="ts">
	import type { ToolType } from './toolbar-types';
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
		line: 'Line',
		rectangle: 'Rectangle',
		ellipse: 'Ellipse',
		eraser: 'Eraser',
		floodfill: 'Flood Fill',
		eyedropper: 'Eyedropper'
	};
</script>

<PixelPanel style="padding: var(--space-1) var(--space-3)">
	<div class="status-bar">
		<div class="status-group">
			<span class="status-value">{canvasWidth} × {canvasHeight}</span>
			<span class="separator"></span>
			<span class="status-value">{zoomPercent}%</span>
		</div>
		<span class="separator"></span>
		<div class="status-group">
			<span class="status-label">Tool:</span>
			<span class="tool-name">{TOOL_LABELS[activeTool]}</span>
		</div>
	</div>
</PixelPanel>

<style>
	.status-bar {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		font-family: var(--font-mono);
		font-size: 11px;
	}

	.status-group {
		display: flex;
		align-items: center;
		gap: var(--space-2);
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
