<script lang="ts">
	import { Undo2, Redo2 } from 'lucide-svelte';
	import * as m from '$lib/paraglide/messages';
	import {
		TOOL_ENTRIES,
		isConstrainToggleTap,
		showsConstrainState,
		toolButtonLabel,
		type ToolType
	} from '$lib/ui-editor/tool-ui';
	import { tooltip } from '$lib/tooltip';

	interface Props {
		activeTool: ToolType;
		canUndo: boolean;
		canRedo: boolean;
		constrainActive: boolean;
		onToolChange: (tool: ToolType) => void;
		onUndo: () => void;
		onRedo: () => void;
		onToggleConstrain: () => void;
	}

	let { activeTool, canUndo, canRedo, constrainActive, onToolChange, onUndo, onRedo, onToggleConstrain }: Props =
		$props();

	// The strip is already at its width budget (9 tools + undo on the narrowest
	// viewport), so the Constrain latch gets no button of its own: re-tapping the
	// active constrainable tool toggles it, and a corner dot shows it is armed.
	function handleToolTap(tool: ToolType) {
		if (isConstrainToggleTap(tool, activeTool)) {
			onToggleConstrain();
			return;
		}
		onToolChange(tool);
	}
</script>

<div class="tool-strip">
	{#each TOOL_ENTRIES as tool}
		<button
			class="tool-btn"
			class:active={activeTool === tool.type}
			onclick={() => handleToolTap(tool.type)}
			aria-label={toolButtonLabel(tool, activeTool, constrainActive)}
			aria-pressed={activeTool === tool.type}
			use:tooltip={`${tool.label()} (${tool.shortcutKey})`}
		>
			<tool.icon size={18} />
			{#if showsConstrainState(tool.type, activeTool, constrainActive)}
				<span class="constrain-badge" aria-hidden="true"></span>
			{/if}
		</button>
	{/each}

	<!-- Undo: always shown -->
	<button
		class="action-btn"
		onclick={onUndo}
		disabled={!canUndo}
		aria-label={m.action_undo()}
		use:tooltip={m.action_undo()}
	>
		<Undo2 size={16} />
	</button>

	<!-- Redo: medium only -->
	<button
		class="action-btn redo-btn"
		onclick={onRedo}
		disabled={!canRedo}
		aria-label={m.action_redo()}
		use:tooltip={m.action_redo()}
	>
		<Redo2 size={16} />
	</button>
</div>

<style>
	.tool-strip {
		display: flex;
		align-items: center;
		justify-content: space-around;
		height: 48px;
		/* 9 tools + undo = 10 × 44px = 440px; buttons flex-shrink below the 44px
		   touch minimum on phone widths — pre-existing width debt, which is why
		   the Constrain latch rides the active tool button instead of adding one. */
		padding: 0 4px;
		background: var(--ds-bg-surface);
		border-top: 1px solid var(--ds-border-subtle);
		flex-shrink: 0;
	}

	@media (min-width: 600px) {
		.tool-strip {
			height: 52px;
			padding: 0 16px;
		}
	}

	.tool-btn {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		width: var(--ds-touch-target-min);
		height: var(--ds-touch-target-min);
		border: none;
		background: none;
		border-radius: 8px;
		color: var(--ds-text-secondary);
		cursor: pointer;
		padding: 0;
	}

	.constrain-badge {
		position: absolute;
		top: 4px;
		right: 4px;
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--ds-accent);
		pointer-events: none;
	}

	@media (min-width: 600px) {
		.tool-btn :global(svg) {
			width: 20px;
			height: 20px;
		}
	}

	.tool-btn:hover {
		background: var(--ds-bg-hover);
	}

	.tool-btn.active {
		background: var(--ds-accent-subtle);
		color: var(--ds-accent);
	}

	.action-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: var(--ds-touch-target-min);
		height: var(--ds-touch-target-min);
		border: none;
		background: none;
		border-radius: 8px;
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

	/* Redo hidden on compact, shown on medium */
	.redo-btn {
		display: none;
	}

	@media (min-width: 600px) {
		.redo-btn {
			display: flex;
		}
	}
</style>
