<script lang="ts">
	import { canvasConstraints } from '$lib/canvas/wasm-backend';
	import { Download, Trash2 } from 'lucide-svelte';
	import * as m from '$lib/paraglide/messages';
	import FloatingPanel from './FloatingPanel.svelte';
	import EditorButton from './EditorButton.svelte';

	const CANVAS_PRESETS = canvasConstraints.presets();
	const MAX_DIMENSION = canvasConstraints.maxDimension;

	interface Props {
		canvasWidth: number;
		canvasHeight: number;
		onResize: (width: number, height: number) => void;
		onExport: () => void;
		onClear: () => void;
	}

	let { canvasWidth, canvasHeight, onResize, onExport, onClear }: Props = $props();

	let inputWidth = $state(0);
	let inputHeight = $state(0);

	$effect(() => {
		inputWidth = canvasWidth;
		inputHeight = canvasHeight;
	});

	function handleResizeCommit(): void {
		const w = Math.max(1, Math.min(MAX_DIMENSION, inputWidth));
		const h = Math.max(1, Math.min(MAX_DIMENSION, inputHeight));
		if (w !== canvasWidth || h !== canvasHeight) {
			onResize(w, h);
		}
	}

	function handleKeyDown(event: KeyboardEvent): void {
		if (event.key === 'Enter') {
			handleResizeCommit();
		}
	}
</script>

<div class="top-controls-right">
	<FloatingPanel>
		<div class="presets">
			{#each CANVAS_PRESETS as size}
				<button
					type="button"
					class="preset-btn"
					class:preset-btn--active={canvasWidth === size && canvasHeight === size}
					title="{size}&times;{size}"
					onclick={() => onResize(size, size)}
				>
					{size}
				</button>
			{/each}
		</div>

		<div class="separator"></div>

		<div class="size-inputs">
			<input
				type="number"
				inputmode="numeric"
				class="size-input"
				bind:value={inputWidth}
				onblur={handleResizeCommit}
				onkeydown={handleKeyDown}
				min="1"
				max={MAX_DIMENSION}
				title={m.canvas_width()}
			/>
			<span class="size-separator">&times;</span>
			<input
				type="number"
				inputmode="numeric"
				class="size-input"
				bind:value={inputHeight}
				onblur={handleResizeCommit}
				onkeydown={handleKeyDown}
				min="1"
				max={MAX_DIMENSION}
				title={m.canvas_height()}
			/>
		</div>
		<EditorButton title={m.label_export()} onclick={onExport}>
			<Download size={18} />
		</EditorButton>
		<EditorButton title={m.action_clearCanvas()} onclick={onClear}>
			<Trash2 size={18} />
		</EditorButton>
	</FloatingPanel>
</div>

<style>
	.top-controls-right {
		position: absolute;
		top: var(--ds-space-5);
		right: var(--ds-space-5);
		z-index: 10;
	}

	.presets {
		display: flex;
		align-items: center;
		gap: var(--ds-space-2);
	}

	.preset-btn {
		padding: var(--ds-space-2) var(--ds-space-3);
		border: none;
		border-radius: 8px;
		background: transparent;
		color: var(--ds-text-secondary);
		font-size: var(--ds-font-size-md);
		cursor: pointer;
	}

	.preset-btn:hover {
		background: var(--ds-bg-elevated);
		color: var(--ds-text-primary);
	}

	.preset-btn--active {
		background: var(--ds-accent);
		color: #FFFFFF;
	}

	.preset-btn--active:hover {
		background: color-mix(in oklch, var(--ds-accent) 85%, black);
		color: #FFFFFF;
	}

	.separator {
		width: 1px;
		height: 28px;
		background: var(--ds-border);
		margin: 0 var(--ds-space-1);
	}

	.size-inputs {
		display: flex;
		align-items: center;
		gap: var(--ds-space-2);
	}

	.size-input {
		width: 48px;
		height: 32px;
		padding: 0 6px;
		border: 1px solid var(--ds-border);
		border-radius: 8px;
		background: var(--ds-bg-elevated);
		color: var(--ds-text-primary);
		font-size: var(--ds-font-size-md);
		text-align: center;
		outline: none;
	}

	.size-input:focus {
		border-color: var(--ds-accent);
	}

	.size-input::-webkit-inner-spin-button,
	.size-input::-webkit-outer-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}

	.size-separator {
		color: var(--ds-text-tertiary);
		font-size: var(--ds-font-size-md);
	}
</style>
