<script lang="ts">
	import { ArrowLeftRight } from 'lucide-svelte';
	import * as m from '$lib/paraglide/messages';
	import HsvPicker from '$lib/color-picker/HsvPicker.svelte';
	import EditorSwatch from './EditorSwatch.svelte';
	import { EDITOR_PALETTE } from './editor-palette-data';

	interface Props {
		foregroundColor: string;
		backgroundColor: string;
		onForegroundColorChange: (hex: string) => void;
		onBackgroundColorChange: (hex: string) => void;
		onSwapColors: () => void;
	}

	let {
		foregroundColor,
		backgroundColor,
		onForegroundColorChange,
		onBackgroundColorChange,
		onSwapColors
	}: Props = $props();

	let contentEl: HTMLDivElement | undefined = $state();
	let pickerWidth = $state(200);

	$effect(() => {
		if (!contentEl) return;
		const ro = new ResizeObserver((entries) => {
			const entry = entries[0];
			if (!entry) return;
			const w = Math.round(entry.contentRect.width) - 32;
			pickerWidth = Math.max(160, Math.min(360, w));
		});
		ro.observe(contentEl);
		return () => ro.disconnect();
	});
</script>

<div class="colors-content" bind:this={contentEl}>
	<!-- FG/BG Section -->
	<div class="fgbg-section">
		<div class="color-preview fg" style:background={foregroundColor}></div>
		<div class="color-preview bg" style:background={backgroundColor}></div>
		<button class="swap-btn" onclick={onSwapColors} aria-label={m.color_swap()}>
			<ArrowLeftRight size={16} />
		</button>
	</div>

	<!-- HSV Picker -->
	<h3 class="section-label">{m.section_hsv()}</h3>
	<div class="picker-area">
		<HsvPicker
			selectedColor={foregroundColor}
			onColorChange={onForegroundColorChange}
			width={pickerWidth}
			height={pickerWidth}
		/>
	</div>

	<!-- Preset Palette -->
	<h3 class="section-label">{m.section_palette()}</h3>
	<div class="preset-grid">
		{#each EDITOR_PALETTE as row}
			{#each row as color}
				<EditorSwatch
					{color}
					size="lg"
					onclick={() => onForegroundColorChange(color)}
				/>
			{/each}
		{/each}
	</div>
</div>

<style>
	.colors-content {
		display: flex;
		flex-direction: column;
		gap: 20px;
		padding: 16px;
		overflow-y: auto;
		height: 100%;
	}

	.fgbg-section {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.color-preview {
		width: 48px;
		height: 48px;
		border-radius: 8px;
		padding: 0;
	}

	.color-preview.fg {
		border: 2px solid var(--ds-accent);
	}

	.color-preview.bg {
		border: 1px solid var(--ds-border);
	}

	.swap-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border: none;
		background: none;
		color: var(--ds-text-tertiary);
		cursor: pointer;
		border-radius: 8px;
		padding: 0;
	}

	.swap-btn:hover {
		background: var(--ds-bg-hover);
		color: var(--ds-text-secondary);
	}

	.section-label {
		margin: 0;
		font-family: var(--ds-font-body);
		font-size: 13px;
		font-weight: 600;
		color: var(--ds-text-secondary);
	}

	.picker-area {
		display: flex;
		justify-content: center;
	}

	.preset-grid {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		gap: 6px;
	}
</style>
