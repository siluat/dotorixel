<script lang="ts">
	import { Undo2, Redo2 } from 'lucide-svelte';
	import * as m from '$lib/paraglide/messages';
	import { TOOL_ENTRIES, isConstrainableTool, type ToolType } from '$lib/ui-editor/tool-ui';
	import {
		focusToolRadio,
		getToolRadioNavigationTarget,
		isToolRadioActivationKey
	} from '$lib/ui-editor/tool-radio-navigation';
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

	const componentId = $props.id();
	const constrainStatusId = `${componentId}-left-toolbar-constrain-status`;
	let toolGroupElement: HTMLDivElement | undefined;

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

	function handleToolKeydown(event: KeyboardEvent, tool: ToolType) {
		if (event.altKey || event.ctrlKey || event.metaKey) {
			return;
		}

		const nextTool = getToolRadioNavigationTarget(tool, event.key);
		if (nextTool) {
			event.preventDefault();
			event.stopPropagation();
			onToolChange(nextTool);
			focusToolRadio(toolGroupElement, nextTool);
			return;
		}

		if (!isToolRadioActivationKey(event.key)) {
			return;
		}

		event.preventDefault();
		event.stopPropagation();
		if (tool === activeTool) {
			if (isConstrainableTool(tool)) {
				onConstrainLatchToggle();
			}
			return;
		}

		onToolChange(tool);
		focusToolRadio(toolGroupElement, tool);
	}
</script>

<aside class="left-toolbar">
	{#if shouldDescribeConstrain}
		<span id={constrainStatusId} class="sr-only" role="status" aria-live="polite">
			{constrainStatusText}
		</span>
	{/if}
	<div
		class="tool-group"
		role="radiogroup"
		aria-label={m.landing_feature_tools_title()}
		bind:this={toolGroupElement}
	>
		{#each TOOL_ENTRIES as tool}
			<button
				class="tool-btn"
				class:active={activeTool === tool.type}
				class:latched={constrainLatchOn && activeTool === tool.type && isConstrainableTool(tool.type)}
				onclick={() => handleToolClick(tool.type)}
				onkeydown={(event) => handleToolKeydown(event, tool.type)}
				role="radio"
				tabindex={activeTool === tool.type ? 0 : -1}
				data-tool-type={tool.type}
				aria-label={tool.label()}
				aria-checked={activeTool === tool.type}
				aria-describedby={activeTool === tool.type && isConstrainableTool(tool.type)
					? constrainStatusId
					: undefined}
				use:tooltip={{ text: `${tool.label()} (${tool.shortcutKey})`, placement: 'right' }}
			>
				<tool.icon size={18} />
			</button>
		{/each}
	</div>

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

	.tool-group {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
	}

	@media (min-width: 1440px) {
		.left-toolbar {
			padding: 8px 0;
			gap: 4px;
		}

		.tool-group {
			gap: 4px;
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
		width: var(--ds-touch-target-min);
		height: var(--ds-touch-target-min);
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
