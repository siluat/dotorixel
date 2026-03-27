<script lang="ts">
	import type { ToolType } from '$lib/canvas/tool-types';
	import { Pencil, Slash, Square, Circle, Eraser, PaintBucket, Pipette, ZoomOut, ZoomIn } from 'lucide-svelte';
	import * as m from '$lib/paraglide/messages';
	import FloatingPanel from './FloatingPanel.svelte';
	import PebbleButton from './PebbleButton.svelte';

	interface Props {
		activeTool: ToolType;
		zoomPercent: number;
		showShortcutHints?: boolean;
		onToolChange: (tool: ToolType) => void;
		onZoomIn: () => void;
		onZoomOut: () => void;
		onZoomReset: () => void;
	}

	let { activeTool, zoomPercent, showShortcutHints = false, onToolChange, onZoomIn, onZoomOut, onZoomReset }: Props =
		$props();

	function hint(key: string): string | undefined {
		return showShortcutHints ? key : undefined;
	}
</script>

<FloatingPanel style="height: 60px; border-radius: var(--pebble-panel-radius-lg); padding: 10px 20px;">
	<PebbleButton
		title={`${m.tool_pencil()} (P)`}
		active={activeTool === 'pencil'}
		shortcutHint={hint('P')}
		onclick={() => onToolChange('pencil')}
	>
		<Pencil size={18} />
	</PebbleButton>
	<PebbleButton
		title={`${m.tool_line()} (L)`}
		active={activeTool === 'line'}
		shortcutHint={hint('L')}
		onclick={() => onToolChange('line')}
	>
		<Slash size={18} />
	</PebbleButton>
	<PebbleButton
		title={`${m.tool_rectangle()} (R)`}
		active={activeTool === 'rectangle'}
		shortcutHint={hint('R')}
		onclick={() => onToolChange('rectangle')}
	>
		<Square size={18} />
	</PebbleButton>
	<PebbleButton
		title={`${m.tool_ellipse()} (C)`}
		active={activeTool === 'ellipse'}
		shortcutHint={hint('C')}
		onclick={() => onToolChange('ellipse')}
	>
		<Circle size={18} />
	</PebbleButton>
	<PebbleButton
		title={`${m.tool_eraser()} (E)`}
		active={activeTool === 'eraser'}
		shortcutHint={hint('E')}
		onclick={() => onToolChange('eraser')}
	>
		<Eraser size={18} />
	</PebbleButton>
	<PebbleButton
		title={`${m.tool_floodfill()} (F)`}
		active={activeTool === 'floodfill'}
		shortcutHint={hint('F')}
		onclick={() => onToolChange('floodfill')}
	>
		<PaintBucket size={18} />
	</PebbleButton>
	<PebbleButton
		title={`${m.tool_eyedropper()} (I)`}
		active={activeTool === 'eyedropper'}
		shortcutHint={hint('I')}
		onclick={() => onToolChange('eyedropper')}
	>
		<Pipette size={18} />
	</PebbleButton>

	<div class="separator"></div>

	<PebbleButton title={m.action_zoomOut()} onclick={onZoomOut}>
		<ZoomOut size={18} />
	</PebbleButton>
	<button type="button" class="zoom-label" title={m.action_resetZoom()} onclick={onZoomReset}>{zoomPercent}%</button>
	<PebbleButton title={m.action_zoomIn()} onclick={onZoomIn}>
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
