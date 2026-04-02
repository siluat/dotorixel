<script lang="ts">
	import {
		Pencil,
		Minus,
		Square,
		Circle,
		Eraser,
		PaintBucket,
		Pipette,
		Move,
		Undo2,
		Redo2
	} from 'lucide-svelte';
	import * as m from '$lib/paraglide/messages';
	import type { ToolType } from '$lib/canvas/tool-types';

	interface Props {
		activeTool: ToolType;
		canUndo: boolean;
		canRedo: boolean;
		onToolChange: (tool: ToolType) => void;
		onUndo: () => void;
		onRedo: () => void;
	}

	let { activeTool, canUndo, canRedo, onToolChange, onUndo, onRedo }: Props = $props();

	const tools: { type: ToolType; icon: typeof Pencil; label: () => string }[] = [
		{ type: 'pencil', icon: Pencil, label: m.tool_pencil },
		{ type: 'line', icon: Minus, label: m.tool_line },
		{ type: 'rectangle', icon: Square, label: m.tool_rectangle },
		{ type: 'ellipse', icon: Circle, label: m.tool_ellipse },
		{ type: 'eraser', icon: Eraser, label: m.tool_eraser },
		{ type: 'floodfill', icon: PaintBucket, label: m.tool_floodfill },
		{ type: 'eyedropper', icon: Pipette, label: m.tool_eyedropper },
		{ type: 'move', icon: Move, label: m.tool_move }
	];
</script>

<div class="tool-strip">
	{#each tools as tool}
		<button
			class="tool-btn"
			class:active={activeTool === tool.type}
			onclick={() => onToolChange(tool.type)}
			aria-label={tool.label()}
			aria-pressed={activeTool === tool.type}
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
	>
		<Undo2 size={16} />
	</button>

	<!-- Redo: medium only -->
	<button
		class="action-btn redo-btn"
		onclick={onRedo}
		disabled={!canRedo}
		aria-label={m.action_redo()}
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
		/* 9 buttons × 44px = 396px; fits 375px+ viewports, may overflow 360px (iPhone SE) */
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
