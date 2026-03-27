<script lang="ts">
	import { WasmPixelCanvas } from '$wasm/dotorixel_wasm';
	import * as m from '$lib/paraglide/messages';
	import PixelPanel from './PixelPanel.svelte';
	import BevelButton from './BevelButton.svelte';

	const CANVAS_PRESETS = Array.from(WasmPixelCanvas.presets());

	function isValidCanvasDimension(value: number): boolean {
		return Number.isInteger(value) && WasmPixelCanvas.is_valid_dimension(value);
	}

	interface Props {
		canvasWidth: number;
		canvasHeight: number;
		onResize: (width: number, height: number) => void;
	}

	let { canvasWidth, canvasHeight, onResize }: Props = $props();

	let customWidth = $state('');
	let customHeight = $state('');

	$effect.pre(() => {
		customWidth = String(canvasWidth);
		customHeight = String(canvasHeight);
	});

	const isWidthValid = $derived(isValidCanvasDimension(Number(customWidth)));
	const isHeightValid = $derived(isValidCanvasDimension(Number(customHeight)));
	const canApply = $derived(isWidthValid && isHeightValid);
	function isCurrentPreset(size: number): boolean {
		return canvasWidth === size && canvasHeight === size;
	}

	function handlePreset(size: number): void {
		onResize(size, size);
	}

	function applyCustomSize(): void {
		if (!canApply) return;
		onResize(Number(customWidth), Number(customHeight));
	}

	function handleKeyDown(event: KeyboardEvent): void {
		if (event.key === 'Enter') {
			applyCustomSize();
		}
	}
</script>

<PixelPanel>
	<div class="canvas-settings">
		<span class="section-label">{m.canvas_size()}</span>
		<span class="current-size">{m.canvas_current()} {canvasWidth} × {canvasHeight}</span>

		<div class="presets">
			{#each CANVAS_PRESETS as size}
				<BevelButton
					size="sm"
					variant={isCurrentPreset(size) ? 'primary' : 'default'}
					onclick={() => handlePreset(size)}
				>
					{size}×{size}
				</BevelButton>
			{/each}
		</div>

		<div class="custom-size">
			<label class="dimension">
				<span class="dim-label">{m.label_widthAbbr()}</span>
				<input
					type="number"
					class="dim-input"
					class:dim-input--invalid={!isWidthValid}
					value={customWidth}
					min="1"
					max="128"
					aria-label={m.canvas_width()}
					aria-invalid={!isWidthValid}
					oninput={(e) => (customWidth = (e.currentTarget as HTMLInputElement).value)}
					onkeydown={handleKeyDown}
				/>
			</label>
			<label class="dimension">
				<span class="dim-label">{m.label_heightAbbr()}</span>
				<input
					type="number"
					class="dim-input"
					class:dim-input--invalid={!isHeightValid}
					value={customHeight}
					min="1"
					max="128"
					aria-label={m.canvas_height()}
					aria-invalid={!isHeightValid}
					oninput={(e) => (customHeight = (e.currentTarget as HTMLInputElement).value)}
					onkeydown={handleKeyDown}
				/>
			</label>
			<BevelButton size="sm" disabled={!canApply} onclick={applyCustomSize}>
				{m.label_apply()}
			</BevelButton>
		</div>
	</div>
</PixelPanel>

<style>
	.canvas-settings {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		width: fit-content;
	}

	.section-label {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--color-muted-fg);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.current-size {
		font-family: var(--font-mono);
		font-size: 13px;
		color: var(--color-surface-fg);
	}

	/* ── Presets ── */

	.presets {
		display: flex;
		gap: var(--space-2);
	}

	/* ── Custom size ── */

	.custom-size {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.dimension {
		display: flex;
		align-items: center;
		gap: var(--space-1);
	}

	.dim-label {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--color-muted-fg);
		text-transform: uppercase;
	}

	.dim-input {
		width: 56px;
		height: 28px;
		padding: 0 var(--space-2);
		font-family: var(--font-mono);
		font-size: 13px;
		color: var(--color-surface-fg);
		background: var(--color-input);
		border: var(--border-width) solid var(--color-border);
		border-top-color: var(--color-border-shadow);
		border-left-color: var(--color-border-shadow);
		border-bottom-color: var(--color-border-highlight);
		border-right-color: var(--color-border-highlight);
		-moz-appearance: textfield;
		appearance: textfield;
	}

	.dim-input::-webkit-inner-spin-button,
	.dim-input::-webkit-outer-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}

	.dim-input:focus {
		outline: 2px solid var(--color-ring);
		outline-offset: -1px;
	}

	.dim-input--invalid {
		border-color: var(--color-destructive);
	}
</style>
