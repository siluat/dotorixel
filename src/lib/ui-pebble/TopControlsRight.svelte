<script lang="ts">
	import { canvasConstraints } from '$lib/canvas/wasm-backend';
	import { Download, Trash2 } from 'lucide-svelte';
	import * as m from '$lib/paraglide/messages';
	import FloatingPanel from './FloatingPanel.svelte';
	import PebbleButton from './PebbleButton.svelte';

	const CANVAS_PRESETS = canvasConstraints.presets();

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
		const w = Math.max(1, Math.min(256, inputWidth));
		const h = Math.max(1, Math.min(256, inputHeight));
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
				max="256"
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
				max="256"
				title={m.canvas_height()}
			/>
		</div>
		<PebbleButton title={m.action_exportPng()} onclick={onExport}>
			<Download size={18} />
		</PebbleButton>
		<PebbleButton title={m.action_clearCanvas()} onclick={onClear}>
			<Trash2 size={18} />
		</PebbleButton>
	</FloatingPanel>
</div>

<style>
	.top-controls-right {
		position: absolute;
		top: var(--pebble-edge-gap);
		right: var(--pebble-edge-gap);
		z-index: 10;
	}

	.presets {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.preset-btn {
		padding: 4px 8px;
		border: none;
		border-radius: 8px;
		background: transparent;
		color: var(--pebble-text-secondary);
		font-size: var(--pebble-font-size);
		cursor: pointer;
	}

	.preset-btn:hover {
		background: var(--pebble-btn-bg);
		color: var(--pebble-text-primary);
	}

	.preset-btn--active {
		background: var(--pebble-accent);
		color: #FFFFFF;
	}

	.preset-btn--active:hover {
		background: var(--pebble-accent-dark);
		color: #FFFFFF;
	}

	.separator {
		width: 1px;
		height: 28px;
		background: var(--pebble-panel-border);
		margin: 0 2px;
	}

	.size-inputs {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.size-input {
		width: 48px;
		height: 32px;
		padding: 0 6px;
		border: 1px solid var(--pebble-panel-border);
		border-radius: 8px;
		background: var(--pebble-btn-bg);
		color: var(--pebble-text-primary);
		font-size: var(--pebble-font-size);
		text-align: center;
		outline: none;
	}

	.size-input:focus {
		border-color: var(--pebble-accent);
	}

	.size-input::-webkit-inner-spin-button,
	.size-input::-webkit-outer-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}

	.size-separator {
		color: var(--pebble-text-muted);
		font-size: var(--pebble-font-size);
	}
</style>
