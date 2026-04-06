<script lang="ts">
	import { ArrowLeftRight } from 'lucide-svelte';
	import * as m from '$lib/paraglide/messages';
	import type { ResizeAnchor } from '$lib/canvas/view-types';
	import HsvPicker from '$lib/color-picker/HsvPicker.svelte';
	import EditorSwatch from './EditorSwatch.svelte';
	import CanvasSizeControl from './CanvasSizeControl.svelte';
	import { EDITOR_PALETTE } from './editor-palette-data';

	interface Props {
		foregroundColor: string;
		backgroundColor: string;
		recentColors: string[];
		canvasWidth: number;
		canvasHeight: number;
		resizeAnchor: ResizeAnchor;
		onForegroundColorChange: (hex: string) => void;
		onBackgroundColorChange: (hex: string) => void;
		onSwapColors: () => void;
		onResize: (width: number, height: number) => void;
		onClear: () => void;
		onAnchorChange: (anchor: ResizeAnchor) => void;
	}

	let {
		foregroundColor,
		backgroundColor,
		recentColors,
		canvasWidth,
		canvasHeight,
		resizeAnchor,
		onForegroundColorChange,
		onBackgroundColorChange,
		onSwapColors,
		onResize,
		onClear,
		onAnchorChange
	}: Props = $props();

	let colorSectionEl: HTMLElement | undefined = $state();
	let pickerWidth = $state(200);

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
</script>

<aside class="right-panel">
	<!-- Canvas Section -->
	<section class="panel-section">
		<h3 class="section-title">{m.section_canvas()}</h3>
		<CanvasSizeControl
			{canvasWidth}
			{canvasHeight}
			{resizeAnchor}
			{onResize}
			{onAnchorChange}
		/>
		<button class="clear-btn" onclick={onClear}>
			{m.action_clearCanvas()}
		</button>
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

	.clear-btn {
		width: 100%;
		height: 28px;
		border: 1px solid var(--ds-border);
		border-radius: 4px;
		background: none;
		color: var(--ds-text-secondary);
		font-family: var(--ds-font-body);
		font-size: var(--ds-font-size-sm);
		cursor: pointer;
	}

	.clear-btn:hover {
		background: var(--ds-bg-hover);
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
