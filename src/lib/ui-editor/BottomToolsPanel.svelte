<script lang="ts">
	import type { ToolType } from '$lib/canvas/tool-types';
	import { Pencil, Slash, Square, Circle, Eraser, PaintBucket, Pipette, Move, ZoomOut, ZoomIn } from 'lucide-svelte';
	import * as m from '$lib/paraglide/messages';
	import { TOOL_SHORTCUT_KEYS } from '$lib/canvas/shortcut-display';
	import { tooltip } from '$lib/tooltip';
	import FloatingPanel from './FloatingPanel.svelte';
	import EditorButton from './EditorButton.svelte';

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

<FloatingPanel style="height: 60px; border-radius: var(--ds-radius-xl); padding: 10px 20px;">
	<EditorButton
		title={`${m.tool_pencil()} (${TOOL_SHORTCUT_KEYS.pencil})`}
		active={activeTool === 'pencil'}
		shortcutHint={hint(TOOL_SHORTCUT_KEYS.pencil)}
		onclick={() => onToolChange('pencil')}
	>
		<Pencil size={18} />
	</EditorButton>
	<EditorButton
		title={`${m.tool_line()} (${TOOL_SHORTCUT_KEYS.line})`}
		active={activeTool === 'line'}
		shortcutHint={hint(TOOL_SHORTCUT_KEYS.line)}
		onclick={() => onToolChange('line')}
	>
		<Slash size={18} />
	</EditorButton>
	<EditorButton
		title={`${m.tool_rectangle()} (${TOOL_SHORTCUT_KEYS.rectangle})`}
		active={activeTool === 'rectangle'}
		shortcutHint={hint(TOOL_SHORTCUT_KEYS.rectangle)}
		onclick={() => onToolChange('rectangle')}
	>
		<Square size={18} />
	</EditorButton>
	<EditorButton
		title={`${m.tool_ellipse()} (${TOOL_SHORTCUT_KEYS.ellipse})`}
		active={activeTool === 'ellipse'}
		shortcutHint={hint(TOOL_SHORTCUT_KEYS.ellipse)}
		onclick={() => onToolChange('ellipse')}
	>
		<Circle size={18} />
	</EditorButton>
	<EditorButton
		title={`${m.tool_eraser()} (${TOOL_SHORTCUT_KEYS.eraser})`}
		active={activeTool === 'eraser'}
		shortcutHint={hint(TOOL_SHORTCUT_KEYS.eraser)}
		onclick={() => onToolChange('eraser')}
	>
		<Eraser size={18} />
	</EditorButton>
	<EditorButton
		title={`${m.tool_floodfill()} (${TOOL_SHORTCUT_KEYS.floodfill})`}
		active={activeTool === 'floodfill'}
		shortcutHint={hint(TOOL_SHORTCUT_KEYS.floodfill)}
		onclick={() => onToolChange('floodfill')}
	>
		<PaintBucket size={18} />
	</EditorButton>
	<EditorButton
		title={`${m.tool_eyedropper()} (${TOOL_SHORTCUT_KEYS.eyedropper})`}
		active={activeTool === 'eyedropper'}
		shortcutHint={hint(TOOL_SHORTCUT_KEYS.eyedropper)}
		onclick={() => onToolChange('eyedropper')}
	>
		<Pipette size={18} />
	</EditorButton>
	<EditorButton
		title={`${m.tool_move()} (${TOOL_SHORTCUT_KEYS.move})`}
		active={activeTool === 'move'}
		shortcutHint={hint(TOOL_SHORTCUT_KEYS.move)}
		onclick={() => onToolChange('move')}
	>
		<Move size={18} />
	</EditorButton>

	<div class="separator"></div>

	<EditorButton title={m.action_zoomOut()} onclick={onZoomOut}>
		<ZoomOut size={18} />
	</EditorButton>
	<button type="button" class="zoom-label" use:tooltip={m.action_resetZoom()} aria-label={m.action_resetZoom()} onclick={onZoomReset}>{zoomPercent}%</button>
	<EditorButton title={m.action_zoomIn()} onclick={onZoomIn}>
		<ZoomIn size={18} />
	</EditorButton>
</FloatingPanel>

<style>
	.separator {
		width: 1px;
		height: 28px;
		background: var(--ds-border);
		margin: 0 var(--ds-space-2);
	}

	.zoom-label {
		min-width: 44px;
		padding: var(--ds-space-2) var(--ds-space-3);
		border: none;
		border-radius: 8px;
		background: transparent;
		text-align: center;
		font-size: var(--ds-font-size-md);
		color: var(--ds-text-secondary);
		cursor: pointer;
		user-select: none;
	}

	.zoom-label:hover {
		background: var(--ds-bg-elevated);
		color: var(--ds-text-primary);
	}
</style>
