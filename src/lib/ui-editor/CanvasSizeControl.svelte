<script lang="ts">
	import { WasmPixelCanvas } from '$wasm/dotorixel_wasm';
	import * as m from '$lib/paraglide/messages';
	import type { ResizeAnchor } from '$lib/canvas/view-types';
	import ValidationAlert from './ValidationAlert.svelte';
	import AnchorSelector from './AnchorSelector.svelte';

	const CANVAS_PRESETS = Array.from(WasmPixelCanvas.presets());
	const MIN_DIMENSION = WasmPixelCanvas.min_dimension();
	const MAX_DIMENSION = WasmPixelCanvas.max_dimension();

	interface Props {
		canvasWidth: number;
		canvasHeight: number;
		resizeAnchor: ResizeAnchor;
		onResize: (width: number, height: number) => void;
		onAnchorChange: (anchor: ResizeAnchor) => void;
		variant?: 'compact' | 'touch';
	}

	let {
		canvasWidth,
		canvasHeight,
		resizeAnchor,
		onResize,
		onAnchorChange,
		variant = 'compact'
	}: Props = $props();

	let inputWidth = $state(0);
	let inputHeight = $state(0);
	let showValidation = $state(false);

	$effect(() => {
		inputWidth = canvasWidth;
		inputHeight = canvasHeight;
		showValidation = false;
	});

	function isValidDimension(value: number): boolean {
		return Number.isInteger(value) && WasmPixelCanvas.is_valid_dimension(value);
	}

	let isWidthValid = $derived(isValidDimension(inputWidth));
	let isHeightValid = $derived(isValidDimension(inputHeight));

	function handleResizeCommit(): void {
		if (!isWidthValid || !isHeightValid) {
			showValidation = true;
			return;
		}
		showValidation = false;
		if (inputWidth !== canvasWidth || inputHeight !== canvasHeight) {
			onResize(inputWidth, inputHeight);
		}
	}

	function handleKeyDown(event: KeyboardEvent): void {
		if (event.key === 'Enter') {
			handleResizeCommit();
		}
	}
</script>

<div class="canvas-size-control" class:touch={variant === 'touch'}>
	<div class="preset-row">
		{#each CANVAS_PRESETS as size}
			<button
				class="preset-btn"
				class:active={canvasWidth === size && canvasHeight === size}
				onclick={() => onResize(size, size)}
			>
				{#if variant === 'touch'}{size} &times; {size}{:else}{size}{/if}
			</button>
		{/each}
	</div>
	<div class="size-row">
		{#if variant === 'touch'}
			<div class="size-field">
				<label class="size-label" for="csc-width">W</label>
				<input
					id="csc-width"
					type="number"
					inputmode="numeric"
					class="size-input"
					class:size-input--error={showValidation && !isWidthValid}
					value={inputWidth}
					oninput={(e) => { inputWidth = Number((e.target as HTMLInputElement).value); }}
					onblur={handleResizeCommit}
					onkeydown={handleKeyDown}
					min="1"
					max={MAX_DIMENSION}
					aria-invalid={showValidation && !isWidthValid}
					title={m.canvas_width()}
				/>
			</div>
			<span class="size-x">&times;</span>
			<div class="size-field">
				<label class="size-label" for="csc-height">H</label>
				<input
					id="csc-height"
					type="number"
					inputmode="numeric"
					class="size-input"
					class:size-input--error={showValidation && !isHeightValid}
					value={inputHeight}
					oninput={(e) => { inputHeight = Number((e.target as HTMLInputElement).value); }}
					onblur={handleResizeCommit}
					onkeydown={handleKeyDown}
					min="1"
					max={MAX_DIMENSION}
					aria-invalid={showValidation && !isHeightValid}
					title={m.canvas_height()}
				/>
			</div>
		{:else}
			<input
				type="number"
				inputmode="numeric"
				class="size-input"
				class:size-input--error={showValidation && !isWidthValid}
				value={inputWidth}
				oninput={(e) => { inputWidth = Number((e.target as HTMLInputElement).value); }}
				onblur={handleResizeCommit}
				onkeydown={handleKeyDown}
				min="1"
				max={MAX_DIMENSION}
				aria-invalid={showValidation && !isWidthValid}
				title={m.canvas_width()}
			/>
			<span class="size-x">&times;</span>
			<input
				type="number"
				inputmode="numeric"
				class="size-input"
				class:size-input--error={showValidation && !isHeightValid}
				value={inputHeight}
				oninput={(e) => { inputHeight = Number((e.target as HTMLInputElement).value); }}
				onblur={handleResizeCommit}
				onkeydown={handleKeyDown}
				min="1"
				max={MAX_DIMENSION}
				aria-invalid={showValidation && !isHeightValid}
				title={m.canvas_height()}
			/>
		{/if}
	</div>
	{#if showValidation}
		<ValidationAlert message={m.validation_dimensionRange({ min: String(MIN_DIMENSION), max: String(MAX_DIMENSION) })} />
	{/if}
	<AnchorSelector selected={resizeAnchor} onSelect={onAnchorChange} />
</div>

<style>
	.canvas-size-control {
		--_error-color: #B0503A;

		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	/* Presets */
	.preset-row {
		display: flex;
		gap: 4px;
	}

	.preset-btn {
		flex: 1;
		height: 28px;
		border: none;
		border-radius: 8px;
		background: var(--ds-bg-hover);
		color: var(--ds-text-primary);
		font-family: var(--ds-font-body);
		font-size: var(--ds-font-size-sm);
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

	.touch .preset-row {
		gap: 8px;
	}

	.touch .preset-btn {
		height: 44px;
		font-size: 13px;
	}

	/* Size inputs */
	.size-row {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.size-input {
		flex: 1;
		height: 28px;
		padding: 0 8px;
		border: 1px solid var(--ds-border);
		border-radius: 4px;
		background: var(--ds-bg-elevated);
		color: var(--ds-text-primary);
		font-family: var(--ds-font-body);
		font-size: var(--ds-font-size-sm);
		text-align: center;
		outline: none;
	}

	.size-input:focus {
		border-color: var(--ds-accent);
		border-width: 2px;
		padding: 0 7px;
	}

	.size-input--error {
		border-color: var(--_error-color);
	}

	.size-input--error:focus {
		border-color: var(--_error-color);
	}

	.size-input::-webkit-inner-spin-button,
	.size-input::-webkit-outer-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}

	.size-x {
		color: var(--ds-text-tertiary);
		font-size: var(--ds-font-size-sm);
	}

	/* Touch variant inputs */
	.touch .size-field {
		display: flex;
		align-items: center;
		flex: 1;
		gap: 8px;
	}

	.touch .size-label {
		font-family: var(--ds-font-body);
		font-size: 13px;
		color: var(--ds-text-tertiary);
	}

	.touch .size-input {
		height: 44px;
		padding: 0 12px;
		border-radius: 8px;
		font-size: 13px;
	}

	.touch .size-input:focus {
		padding: 0 11px;
	}

	.touch .size-x {
		font-size: 14px;
	}
</style>
