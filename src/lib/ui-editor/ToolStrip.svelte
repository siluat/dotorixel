<script lang="ts">
	import { Undo2, Redo2 } from 'lucide-svelte';
	import * as m from '$lib/paraglide/messages';
	import {
		TOOL_ENTRIES,
		showsConstrainState,
		constrainStatusMessage,
		activateTool,
		handleToolRadiogroupKeydown,
		type ToolType
	} from '$lib/ui-editor/tool-ui';
	import { isConstrainableTool } from '$lib/canvas/tool-registry';
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

	let radiogroupEl: HTMLElement;
	const uid = $props.id();
	const statusId = `${uid}-constrain-status`;
	let isActiveConstrainable = $derived(isConstrainableTool(activeTool));

	// The strip is already at its width budget (9 tools + undo on the narrowest
	// viewport), so the Constrain latch gets no button of its own: re-tapping the
	// active constrainable tool toggles it, and a corner dot shows it is armed.
	let activation = $derived({ activeTool, onToolChange, onToggleConstrain });

	function focusTool(tool: ToolType) {
		radiogroupEl?.querySelector<HTMLElement>(`[data-tool="${tool}"]`)?.focus();
	}
</script>

<div class="tool-strip">
	<div class="tool-group" role="radiogroup" aria-label={m.aria_toolSelection()} bind:this={radiogroupEl}>
		{#each TOOL_ENTRIES as tool}
			<button
				class="tool-btn"
				class:active={activeTool === tool.type}
				role="radio"
				aria-checked={activeTool === tool.type}
				tabindex={activeTool === tool.type ? 0 : -1}
				data-tool={tool.type}
				aria-label={tool.label()}
				aria-describedby={activeTool === tool.type && isActiveConstrainable ? statusId : undefined}
				onclick={() => activateTool(tool.type, activation)}
				onkeydown={(e) => handleToolRadiogroupKeydown(e, activation, focusTool)}
				use:tooltip={`${tool.label()} (${tool.shortcutKey})`}
			>
				<tool.icon size={18} />
				{#if showsConstrainState(tool.type, activeTool, constrainActive)}
					<span class="constrain-badge" aria-hidden="true"></span>
				{/if}
			</button>
		{/each}
	</div>

	<!-- The latch status is a separate announcement channel, not a group member, so it
	     lives as a sibling of the radiogroup (which owns only radios). -->
	{#if isActiveConstrainable}
		<span id={statusId} class="sr-only" role="status" aria-live="polite"
			>{constrainStatusMessage(constrainActive)}</span
		>
	{/if}

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

	/* The radiogroup wraps only the tool buttons (not undo/redo); display:contents
	   keeps them as direct flex children of the strip so layout is unchanged. */
	.tool-group {
		display: contents;
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
