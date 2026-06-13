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
	let activation = $derived({ activeTool, onToolChange, onToggleConstrain });

	function focusTool(tool: ToolType) {
		radiogroupEl?.querySelector<HTMLElement>(`[data-tool="${tool}"]`)?.focus();
	}
</script>

<aside class="left-toolbar">
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
				use:tooltip={{ text: `${tool.label()} (${tool.shortcutKey})`, placement: 'right' }}
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

	/* The radiogroup wraps only the tool buttons (not undo/redo); display:contents
	   keeps them as direct flex children of the column so layout is unchanged. */
	.tool-group {
		display: contents;
	}

	/* The 18px icon stays visually small; the 44px button box provides the hit area
	   (per the screen inventory's "44px hit areas via padding" note). */
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

	.constrain-badge {
		position: absolute;
		top: 2px;
		right: 2px;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--ds-accent);
		pointer-events: none;
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

	/* x-wide widens the docked strip to 48px hit areas (screen inventory §3.1). */
	@media (min-width: 1440px) {
		.tool-btn,
		.action-btn {
			width: 48px;
			height: 48px;
		}
	}
</style>
