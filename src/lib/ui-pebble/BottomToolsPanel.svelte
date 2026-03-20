<script lang="ts">
	import type { ToolType } from '$lib/ui-pixel/toolbar-types';
	import { Pencil, Eraser, ZoomOut, ZoomIn } from 'lucide-svelte';
	import FloatingPanel from './FloatingPanel.svelte';
	import PebbleButton from './PebbleButton.svelte';

	interface Props {
		activeTool: ToolType;
		zoomPercent: number;
		onToolChange: (tool: ToolType) => void;
		onZoomIn: () => void;
		onZoomOut: () => void;
		onZoomReset: () => void;
	}

	let { activeTool, zoomPercent, onToolChange, onZoomIn, onZoomOut, onZoomReset }: Props =
		$props();
</script>

<FloatingPanel style="height: 60px; border-radius: var(--pebble-panel-radius-lg); padding: 10px 20px;">
	<PebbleButton
		title="Pen"
		active={activeTool === 'pencil'}
		onclick={() => onToolChange('pencil')}
	>
		<Pencil size={18} />
	</PebbleButton>
	<PebbleButton
		title="Eraser"
		active={activeTool === 'eraser'}
		onclick={() => onToolChange('eraser')}
	>
		<Eraser size={18} />
	</PebbleButton>

	<div class="separator"></div>

	<PebbleButton title="Zoom Out" onclick={onZoomOut}>
		<ZoomOut size={18} />
	</PebbleButton>
	<button type="button" class="zoom-label" title="Reset zoom to 100%" onclick={onZoomReset}>{zoomPercent}%</button>
	<PebbleButton title="Zoom In" onclick={onZoomIn}>
		<ZoomIn size={18} />
	</PebbleButton>
</FloatingPanel>

<style>
	.separator {
		width: 1px;
		height: 28px;
		background: var(--pebble-panel-border);
		margin: 0 4px;
	}

	.zoom-label {
		min-width: 44px;
		padding: 4px 8px;
		border: none;
		border-radius: 8px;
		background: transparent;
		text-align: center;
		font-size: var(--pebble-font-size);
		color: var(--pebble-text-secondary);
		cursor: pointer;
		user-select: none;
	}

	.zoom-label:hover {
		background: var(--pebble-btn-bg);
		color: var(--pebble-text-primary);
	}
</style>
