<script lang="ts">
	import { ZoomOut, ZoomIn } from 'lucide-svelte';
	import * as m from '$lib/paraglide/messages';
	import { TOOL_ENTRIES, type ToolType } from '$lib/ui-editor/tool-ui';
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
	{#each TOOL_ENTRIES as tool}
		<EditorButton
			title={`${tool.label()} (${tool.shortcutKey})`}
			active={activeTool === tool.type}
			shortcutHint={hint(tool.shortcutKey)}
			onclick={() => onToolChange(tool.type)}
		>
			<tool.icon size={18} />
		</EditorButton>
	{/each}

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
