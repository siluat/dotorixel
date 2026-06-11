<script lang="ts">
	import { Undo2, Redo2 } from 'lucide-svelte';
	import * as m from '$lib/paraglide/messages';
	import { TOOL_ENTRIES, isConstrainableTool, type ToolType } from '$lib/ui-editor/tool-ui';
	import { tooltip } from '$lib/tooltip';

	interface Props {
		activeTool: ToolType;
		canUndo: boolean;
		canRedo: boolean;
		constrainLatchOn: boolean;
		onToolChange: (tool: ToolType) => void;
		onUndo: () => void;
		onRedo: () => void;
		onConstrainLatchToggle: () => void;
	}

	let {
		activeTool,
		canUndo,
		canRedo,
		constrainLatchOn,
		onToolChange,
		onUndo,
		onRedo,
		onConstrainLatchToggle
	}: Props = $props();

	const constrainStatusId = 'tool-strip-constrain-status';

	const shouldDescribeConstrain = $derived(isConstrainableTool(activeTool));
	const constrainStatusText = $derived(
		constrainLatchOn ? m.status_constrainLatchOn() : m.status_constrainLatchOff()
	);

	function handleToolClick(tool: ToolType) {
		if (tool === activeTool && isConstrainableTool(tool)) {
			onConstrainLatchToggle();
			return;
		}

		onToolChange(tool);
	}
</script>

<div class="tool-strip-shell">
	{#if shouldDescribeConstrain}
		<span id={constrainStatusId} class="sr-only" role="status" aria-live="polite">
			{constrainStatusText}
		</span>
	{/if}
	<div class="tool-strip">
		{#each TOOL_ENTRIES as tool}
			<button
				class="tool-btn"
				class:active={activeTool === tool.type}
				class:latched={constrainLatchOn && activeTool === tool.type && isConstrainableTool(tool.type)}
				onclick={() => handleToolClick(tool.type)}
				aria-label={tool.label()}
				aria-describedby={activeTool === tool.type && isConstrainableTool(tool.type)
					? constrainStatusId
					: undefined}
				aria-pressed={activeTool === tool.type}
				use:tooltip={`${tool.label()} (${tool.shortcutKey})`}
			>
				<tool.icon size={18} />
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
</div>

<style>
	.tool-strip-shell {
		position: relative;
		width: 100%;
		min-width: 0;
		flex-shrink: 0;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	.tool-strip {
		display: flex;
		align-items: center;
		justify-content: flex-start;
		height: 48px;
		padding: 0 4px;
		background: var(--ds-bg-surface);
		border-top: 1px solid var(--ds-border-subtle);
		overflow-x: auto;
		overscroll-behavior-x: contain;
		scrollbar-width: none;
		touch-action: pan-x;
		flex-shrink: 0;
	}

	.tool-strip::-webkit-scrollbar {
		display: none;
	}

	@media (min-width: 600px) {
		.tool-strip {
			justify-content: space-around;
			height: 52px;
			padding: 0 16px;
			overflow-x: visible;
			touch-action: auto;
		}
	}

	.tool-btn {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		flex: 0 0 var(--ds-touch-target-min);
		width: var(--ds-touch-target-min);
		height: var(--ds-touch-target-min);
		border: none;
		background: none;
		border-radius: 8px;
		color: var(--ds-text-secondary);
		cursor: pointer;
		padding: 0;
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

	.tool-btn.latched::after {
		content: '';
		position: absolute;
		right: 6px;
		top: 6px;
		width: 8px;
		height: 8px;
		border-radius: 999px;
		background: var(--ds-accent);
		box-shadow:
			0 0 0 2px var(--ds-bg-surface),
			0 0 0 3px var(--ds-accent);
	}

	.action-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		flex: 0 0 var(--ds-touch-target-min);
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
