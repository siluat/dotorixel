<script lang="ts">
	import { TOOL_ENTRIES, type ToolType } from '$lib/ui-editor/tool-ui';

	interface Props {
		canvasWidth: number;
		canvasHeight: number;
		activeTool: ToolType;
	}

	let { canvasWidth, canvasHeight, activeTool }: Props = $props();

	const activeLabel = $derived(TOOL_ENTRIES.find((t) => t.type === activeTool)?.label() ?? '');
</script>

<footer class="status-bar">
	<span class="status-size">{canvasWidth} &times; {canvasHeight}</span>
	<div class="status-spacer"></div>
	<span class="status-tool">{activeLabel}</span>
</footer>

<style>
	.status-bar {
		display: flex;
		align-items: center;
		gap: var(--ds-space-5);
		padding: 0 var(--ds-space-4) env(safe-area-inset-bottom, 0px);
		background: var(--ds-bg-surface);
		border-top: 1px solid var(--ds-border-subtle);
	}

	.status-size {
		font-family: var(--ds-font-body);
		font-size: var(--ds-font-size-sm);
		color: var(--ds-text-secondary);
		white-space: nowrap;
	}

	.status-spacer {
		flex: 1;
	}

	.status-tool {
		font-family: var(--ds-font-body);
		font-size: var(--ds-font-size-sm);
		color: var(--ds-text-tertiary);
		white-space: nowrap;
	}
</style>
