<script lang="ts">
	import { Undo2, Redo2 } from 'lucide-svelte';
	import * as m from '$lib/paraglide/messages';
	import { TOOL_ENTRIES, type ToolType } from '$lib/ui-editor/tool-ui';
	import { tooltip } from '$lib/tooltip';

	interface Props {
		activeTool: ToolType;
		canUndo: boolean;
		canRedo: boolean;
		onToolChange: (tool: ToolType) => void;
		onUndo: () => void;
		onRedo: () => void;
	}

	let { activeTool, canUndo, canRedo, onToolChange, onUndo, onRedo }: Props = $props();
</script>

<aside class="left-toolbar">
	{#each TOOL_ENTRIES as tool}
		<button
			class="tool-btn"
			class:active={activeTool === tool.type}
			onclick={() => onToolChange(tool.type)}
			aria-label={tool.label()}
			aria-pressed={activeTool === tool.type}
			use:tooltip={{ text: `${tool.label()} (${tool.shortcutKey})`, placement: 'right' }}
		>
			<tool.icon size={18} />
		</button>
	{/each}

	<div class="separator"></div>

	<button
		class="action-btn"
		onclick={onUndo}
		disabled={!canUndo}
		aria-label={m.action_undo()}
		use:tooltip={{ text: m.action_undo(), placement: 'right' }}
	>
		<Undo2 size={16} />
	</button>
	<button
		class="action-btn"
		onclick={onRedo}
		disabled={!canRedo}
		aria-label={m.action_redo()}
		use:tooltip={{ text: m.action_redo(), placement: 'right' }}
	>
		<Redo2 size={16} />
	</button>
</aside>

<style>
	.left-toolbar {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 6px 0;
		gap: 2px;
		background: var(--ds-bg-surface);
		border-right: 1px solid var(--ds-border-subtle);
		overflow-y: auto;
	}

	@media (min-width: 1440px) {
		.left-toolbar {
			padding: 8px 0;
			gap: 4px;
		}
	}

	.tool-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border: none;
		background: none;
		border-radius: var(--ds-radius-sm);
		color: var(--ds-text-secondary);
		cursor: pointer;
		padding: 0;
	}

	.tool-btn:hover {
		background: var(--ds-bg-hover);
	}

	.tool-btn.active {
		background: var(--ds-accent-subtle);
		color: var(--ds-accent);
	}

	.separator {
		width: 28px;
		height: 1px;
		background: var(--ds-border-subtle);
		margin: 2px 0;
	}

	@media (min-width: 1440px) {
		.separator {
			margin: 4px 0;
		}
	}

	.action-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border: none;
		background: none;
		border-radius: var(--ds-radius-sm);
		color: var(--ds-text-tertiary);
		cursor: pointer;
		padding: 0;
	}

	.action-btn:hover:not(:disabled) {
		background: var(--ds-bg-hover);
		color: var(--ds-text-secondary);
	}

	.action-btn:disabled {
		opacity: 0.4;
		cursor: default;
	}
</style>
