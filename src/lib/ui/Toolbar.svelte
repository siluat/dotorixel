<script lang="ts">
	import type { ToolType } from '$lib/canvas/tool';
	import PixelPanel from './PixelPanel.svelte';
	import PixelButton from './PixelButton.svelte';
	import {
		Pencil,
		Eraser,
		Undo2,
		Redo2,
		ZoomOut,
		ZoomIn,
		Maximize2,
		Grid3X3,
		Trash2,
		Download
	} from 'lucide-svelte';

	interface Props {
		activeTool: ToolType;
		canUndo: boolean;
		canRedo: boolean;
		zoomPercent: number;
		showGrid: boolean;
		onToolChange: (tool: ToolType) => void;
		onUndo: () => void;
		onRedo: () => void;
		onZoomIn: () => void;
		onZoomOut: () => void;
		onFit: () => void;
		onGridToggle: () => void;
		onClear: () => void;
		onExport: () => void;
	}

	let {
		activeTool,
		canUndo,
		canRedo,
		zoomPercent,
		showGrid,
		onToolChange,
		onUndo,
		onRedo,
		onZoomIn,
		onZoomOut,
		onFit,
		onGridToggle,
		onClear,
		onExport
	}: Props = $props();

	const ICON_SIZE = 16;

	const tools: { type: ToolType; icon: typeof Pencil; label: string }[] = [
		{ type: 'pencil', icon: Pencil, label: 'Pencil' },
		{ type: 'eraser', icon: Eraser, label: 'Eraser' }
	];
</script>

<PixelPanel style="padding: var(--space-2)">
	<div class="toolbar">
		<div class="toolbar-group">
			{#each tools as tool}
				{@const Icon = tool.icon}
				<PixelButton
					size="icon"
					active={activeTool === tool.type}
					title={tool.label}
					onclick={() => onToolChange(tool.type)}
				>
					<Icon size={ICON_SIZE} />
				</PixelButton>
			{/each}
		</div>

		<span class="separator"></span>

		<div class="toolbar-group">
			<PixelButton size="icon" disabled={!canUndo} title="Undo" onclick={onUndo}>
				<Undo2 size={ICON_SIZE} />
			</PixelButton>
			<PixelButton size="icon" disabled={!canRedo} title="Redo" onclick={onRedo}>
				<Redo2 size={ICON_SIZE} />
			</PixelButton>
		</div>

		<span class="separator"></span>

		<div class="toolbar-group">
			<PixelButton size="icon" title="Zoom Out" onclick={onZoomOut}>
				<ZoomOut size={ICON_SIZE} />
			</PixelButton>
			<span class="zoom-label">{zoomPercent}%</span>
			<PixelButton size="icon" title="Zoom In" onclick={onZoomIn}>
				<ZoomIn size={ICON_SIZE} />
			</PixelButton>
			<PixelButton size="icon" title="Fit to View" onclick={onFit}>
				<Maximize2 size={ICON_SIZE} />
			</PixelButton>
			<PixelButton size="icon" active={showGrid} title="Toggle Grid" onclick={onGridToggle}>
				<Grid3X3 size={ICON_SIZE} />
			</PixelButton>
		</div>

		<span class="separator"></span>

		<div class="toolbar-group">
			<PixelButton size="icon" title="Clear Canvas" onclick={onClear}>
				<Trash2 size={ICON_SIZE} />
			</PixelButton>
			<PixelButton variant="secondary" size="icon" title="Export PNG" onclick={onExport}>
				<Download size={ICON_SIZE} />
			</PixelButton>
		</div>
	</div>
</PixelPanel>

<style>
	.toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
	}

	.toolbar-group {
		display: flex;
		align-items: center;
		gap: var(--space-1);
	}

	.separator {
		width: var(--border-width);
		height: var(--space-6);
		background: var(--color-border);
		margin: 0 var(--space-2);
	}

	.zoom-label {
		font-family: var(--font-mono);
		font-size: 12px;
		font-variant-numeric: tabular-nums;
		min-width: 40px;
		text-align: center;
	}
</style>
