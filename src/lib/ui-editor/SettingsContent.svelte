<script lang="ts">
	import { WasmPixelCanvas } from '$wasm/dotorixel_wasm';
	import { Download, Trash2 } from 'lucide-svelte';
	import * as m from '$lib/paraglide/messages';

	const CANVAS_PRESETS = Array.from(WasmPixelCanvas.presets());
	const MAX_DIMENSION = WasmPixelCanvas.max_dimension();

	interface Props {
		canvasWidth: number;
		canvasHeight: number;
		showGrid: boolean;
		onResize: (width: number, height: number) => void;
		onExport: () => void;
		onClear: () => void;
		onGridToggle: () => void;
	}

	let { canvasWidth, canvasHeight, showGrid, onResize, onExport, onClear, onGridToggle }: Props =
		$props();

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

<div class="settings-content">
	<!-- Canvas Size Section -->
	<section class="section">
		<h3 class="section-title">{m.canvas_size()}</h3>
		<div class="preset-grid">
			{#each CANVAS_PRESETS as size}
				<button
					class="preset-btn"
					class:active={canvasWidth === size && canvasHeight === size}
					onclick={() => onResize(size, size)}
				>
					{size} &times; {size}
				</button>
			{/each}
		</div>
		<div class="size-row">
			<div class="size-field">
				<label class="size-label" for="settings-width">W</label>
				<input
					id="settings-width"
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
			</div>
			<span class="size-x">&times;</span>
			<div class="size-field">
				<label class="size-label" for="settings-height">H</label>
				<input
					id="settings-height"
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
		</div>
	</section>

	<!-- Actions Section -->
	<section class="section">
		<h3 class="section-title">{m.section_actions()}</h3>
		<button class="action-btn primary" onclick={onExport}>
			<Download size={18} />
			<span>{m.action_exportPng()}</span>
		</button>
		<button class="action-btn outline" onclick={onClear}>
			<Trash2 size={18} />
			<span>{m.action_clearCanvas()}</span>
		</button>
	</section>

	<!-- Display Section -->
	<section class="section">
		<h3 class="section-title">{m.section_display()}</h3>
		<div class="toggle-row">
			<span class="toggle-label">{m.label_showGrid()}</span>
			<button
				class="toggle-switch"
				class:active={showGrid}
				onclick={onGridToggle}
				role="switch"
				aria-checked={showGrid}
				aria-label={m.label_showGrid()}
			>
				<span class="toggle-thumb"></span>
			</button>
		</div>
	</section>
</div>

<style>
	.settings-content {
		display: flex;
		flex-direction: column;
		gap: 24px;
		padding: 16px;
		overflow-y: auto;
		height: 100%;
	}

	.section {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.section-title {
		margin: 0;
		font-family: var(--ds-font-body);
		font-size: 14px;
		font-weight: 600;
		color: var(--ds-text-primary);
	}

	/* Presets */
	.preset-grid {
		display: flex;
		gap: 8px;
	}

	.preset-btn {
		flex: 1;
		height: 44px;
		border: none;
		border-radius: 8px;
		background: var(--ds-bg-hover);
		color: var(--ds-text-primary);
		font-family: var(--ds-font-body);
		font-size: 13px;
		cursor: pointer;
		padding: 0;
	}

	.preset-btn:hover {
		background: var(--ds-bg-active);
	}

	.preset-btn.active {
		background: var(--ds-accent);
		color: #ffffff;
	}

	/* Size inputs */
	.size-row {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.size-field {
		display: flex;
		align-items: center;
		flex: 1;
		gap: 8px;
	}

	.size-label {
		font-family: var(--ds-font-body);
		font-size: 13px;
		color: var(--ds-text-tertiary);
	}

	.size-input {
		flex: 1;
		height: 44px;
		padding: 0 12px;
		border: 1px solid var(--ds-border);
		border-radius: 8px;
		background: var(--ds-bg-elevated);
		color: var(--ds-text-primary);
		font-family: var(--ds-font-body);
		font-size: 13px;
		text-align: center;
		outline: none;
	}

	.size-input:focus {
		border-color: var(--ds-accent);
		border-width: 2px;
		padding: 0 11px;
	}

	.size-input::-webkit-inner-spin-button,
	.size-input::-webkit-outer-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}

	.size-x {
		color: var(--ds-text-tertiary);
		font-size: 14px;
	}

	/* Actions */
	.action-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		width: 100%;
		height: 44px;
		border-radius: 8px;
		font-family: var(--ds-font-body);
		font-size: 13px;
		cursor: pointer;
		padding: 0;
	}

	.action-btn.primary {
		background: var(--ds-accent);
		border: none;
		color: #ffffff;
	}

	.action-btn.primary:hover {
		background: color-mix(in srgb, var(--ds-accent) 85%, black);
	}

	.action-btn.outline {
		background: none;
		border: 1px solid var(--ds-border);
		color: var(--ds-text-secondary);
	}

	.action-btn.outline:hover {
		background: var(--ds-bg-hover);
	}

	/* Toggle */
	.toggle-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 44px;
	}

	.toggle-label {
		font-family: var(--ds-font-body);
		font-size: 13px;
		color: var(--ds-text-primary);
	}

	.toggle-switch {
		position: relative;
		width: 44px;
		height: 26px;
		border: none;
		border-radius: 13px;
		background: var(--ds-bg-active);
		cursor: pointer;
		padding: 2px;
		transition: background 0.15s;
	}

	.toggle-switch.active {
		background: var(--ds-accent);
	}

	.toggle-thumb {
		display: block;
		width: 22px;
		height: 22px;
		border-radius: 50%;
		background: #ffffff;
		box-shadow: var(--ds-shadow-sm);
		transition: transform 0.15s;
	}

	.toggle-switch.active .toggle-thumb {
		transform: translateX(18px);
	}
</style>
