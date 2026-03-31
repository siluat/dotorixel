<script lang="ts">
	import { WasmPixelCanvas } from '$wasm/dotorixel_wasm';
	import { ArrowLeftRight } from 'lucide-svelte';
	import * as m from '$lib/paraglide/messages';
	import HsvPicker from '$lib/color-picker/HsvPicker.svelte';
	import EditorSwatch from './EditorSwatch.svelte';
	import { EDITOR_PALETTE } from './editor-palette-data';

	const CANVAS_PRESETS = Array.from(WasmPixelCanvas.presets());
	const MAX_DIMENSION = WasmPixelCanvas.max_dimension();

	interface Props {
		foregroundColor: string;
		backgroundColor: string;
		recentColors: string[];
		canvasWidth: number;
		canvasHeight: number;
		onForegroundColorChange: (hex: string) => void;
		onBackgroundColorChange: (hex: string) => void;
		onSwapColors: () => void;
		onResize: (width: number, height: number) => void;
		onClear: () => void;
	}

	let {
		foregroundColor,
		backgroundColor,
		recentColors,
		canvasWidth,
		canvasHeight,
		onForegroundColorChange,
		onBackgroundColorChange,
		onSwapColors,
		onResize,
		onClear
	}: Props = $props();

	let inputWidth = $state(0);
	let inputHeight = $state(0);
	let colorSectionEl: HTMLElement | undefined = $state();
	let pickerWidth = $state(200);

	$effect(() => {
		inputWidth = canvasWidth;
		inputHeight = canvasHeight;
	});

	$effect(() => {
		if (!colorSectionEl) return;
		const ro = new ResizeObserver((entries) => {
			const entry = entries[0];
			if (!entry) return;
			pickerWidth = Math.round(entry.contentRect.width);
		});
		ro.observe(colorSectionEl);
		return () => ro.disconnect();
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

<aside class="right-panel">
	<!-- Canvas Section -->
	<section class="panel-section">
		<h3 class="section-title">{m.section_canvas()}</h3>
		<div class="preset-row">
			{#each CANVAS_PRESETS as size}
				<button
					class="preset-btn"
					class:active={canvasWidth === size && canvasHeight === size}
					onclick={() => onResize(size, size)}
				>
					{size}
				</button>
			{/each}
		</div>
		<div class="size-row">
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
			<span class="size-x">&times;</span>
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
	</section>

	<hr class="divider" />

	<!-- Color Section -->
	<section class="panel-section color-section" bind:this={colorSectionEl}>
		<h3 class="section-title">{m.section_color()}</h3>

		<div class="fgbg-row">
			<div class="color-swatch fg" style:background={foregroundColor}></div>
			<div class="color-swatch bg" style:background={backgroundColor}></div>
			<button class="swap-btn" onclick={onSwapColors} aria-label={m.color_swap()}>
				<ArrowLeftRight size={14} />
			</button>
		</div>

		<div class="hex-row">
			<span class="hex-hash">#</span>
			<span class="hex-value">{foregroundColor.replace('#', '')}</span>
		</div>

		<h3 class="section-title">{m.section_hsv()}</h3>
		<HsvPicker
			selectedColor={foregroundColor}
			onColorChange={onForegroundColorChange}
			width={pickerWidth}
			height={140}
		/>

		<h3 class="section-title">{m.section_palette()}</h3>
		<div class="palette-grid">
			{#each EDITOR_PALETTE as row}
				{#each row as color}
					<EditorSwatch
						{color}
						size="sm"
						onclick={() => onForegroundColorChange(color)}
					/>
				{/each}
			{/each}
		</div>

		{#if recentColors.length > 0}
			<span class="recent-label">Recent</span>
			<div class="recent-row">
				{#each recentColors as color}
					<button
						class="recent-swatch"
						style:background={color}
						onclick={() => onForegroundColorChange(color)}
						aria-label="Recent color {color}"
					></button>
				{/each}
			</div>
		{/if}
	</section>
</aside>

<style>
	.right-panel {
		display: flex;
		flex-direction: column;
		gap: 16px;
		padding: 12px;
		background: var(--ds-bg-surface);
		border-left: 1px solid var(--ds-border-subtle);
		overflow-y: auto;
	}

	@media (min-width: 1024px) and (max-width: 1439px) {
		.right-panel {
			gap: 12px;
			padding: 10px;
		}
	}

	.panel-section {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.section-title {
		margin: 0;
		font-family: var(--ds-font-body);
		font-size: var(--ds-font-size-sm);
		font-weight: 600;
		color: var(--ds-text-secondary);
	}

	/* Canvas presets */
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

	.size-input::-webkit-inner-spin-button,
	.size-input::-webkit-outer-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}

	.size-x {
		color: var(--ds-text-tertiary);
		font-size: var(--ds-font-size-sm);
	}

	/* Divider */
	.divider {
		border: none;
		height: 1px;
		background: var(--ds-border-subtle);
		margin: 0;
	}

	/* Color section */
	.color-section {
		flex: 1;
		min-height: 0;
	}

	.fgbg-row {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.color-swatch {
		width: 28px;
		height: 28px;
		border-radius: 4px;
		padding: 0;
	}

	.color-swatch.fg {
		border: 2px solid var(--ds-accent);
	}

	.color-swatch.bg {
		border: 1px solid var(--ds-border);
	}

	.swap-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		border: none;
		background: none;
		color: var(--ds-text-tertiary);
		cursor: pointer;
		border-radius: 4px;
		padding: 0;
	}

	.swap-btn:hover {
		background: var(--ds-bg-hover);
		color: var(--ds-text-secondary);
	}

	.hex-row {
		display: flex;
		align-items: center;
		gap: 4px;
		height: 28px;
		padding: 0 8px;
		background: var(--ds-bg-elevated);
		border: 1px solid var(--ds-border);
		border-radius: 4px;
	}

	.hex-hash {
		color: var(--ds-text-tertiary);
		font-size: var(--ds-font-size-sm);
	}

	.hex-value {
		color: var(--ds-text-primary);
		font-size: var(--ds-font-size-sm);
		text-transform: uppercase;
	}

	/* Palette grid */
	.palette-grid {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		gap: 3px;
	}

	/* Recent */
	.recent-label {
		font-size: var(--ds-font-size-sm);
		color: var(--ds-text-tertiary);
	}

	.recent-row {
		display: flex;
		gap: 3px;
	}

	.recent-swatch {
		width: 22px;
		height: 22px;
		border-radius: 3px;
		border: none;
		cursor: pointer;
		padding: 0;
	}

	.recent-swatch:hover {
		transform: scale(1.1);
	}
</style>
