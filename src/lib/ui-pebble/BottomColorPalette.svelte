<script lang="ts">
	import { PEBBLE_PALETTE } from './pebble-palette-data';
	import FloatingPanel from './FloatingPanel.svelte';
	import PebbleSwatch from './PebbleSwatch.svelte';
	import ColorPickerPopup from '$lib/color-picker/ColorPickerPopup.svelte';
	import FgBgPreview from '$lib/color-picker/FgBgPreview.svelte';

	interface Props {
		foregroundColor: string;
		backgroundColor?: string;
		onColorChange: (hex: string) => void;
		onSwapColors?: () => void;
	}

	let { foregroundColor, backgroundColor = '#ffffff', onColorChange, onSwapColors }: Props = $props();

	let isPickerOpen = $state(false);
	let anchorEl: HTMLDivElement | undefined = $state();

	$effect(() => {
		if (!isPickerOpen) return;
		function handleOutsidePointerDown(e: PointerEvent): void {
			if (anchorEl && !anchorEl.contains(e.target as Node)) {
				isPickerOpen = false;
			}
		}
		document.addEventListener('pointerdown', handleOutsidePointerDown);
		return () => document.removeEventListener('pointerdown', handleOutsidePointerDown);
	});
</script>

<FloatingPanel style="height: 68px; border-radius: var(--pebble-panel-radius); padding: 10px 16px;">
	<div class="fg-bg-wrapper">
		<FgBgPreview {foregroundColor} {backgroundColor} {onSwapColors} />
	</div>

	<div class="separator"></div>

	<div class="preset-grid">
		{#each PEBBLE_PALETTE as row}
			<div class="preset-row">
				{#each row as color}
					<PebbleSwatch
						{color}
						selected={color.toUpperCase() === foregroundColor.toUpperCase()}
						onclick={() => onColorChange(color)}
					/>
				{/each}
			</div>
		{/each}
	</div>

	<div class="separator"></div>

	<div class="picker-anchor" bind:this={anchorEl}>
		<button
			class="picker-button"
			style:background-color={foregroundColor}
			title="Custom color"
			onclick={() => (isPickerOpen = !isPickerOpen)}
		></button>

		{#if isPickerOpen}
			<div class="picker-popup">
				<ColorPickerPopup
					selectedColor={foregroundColor}
					{onColorChange}
					onClose={() => (isPickerOpen = false)}
				/>
			</div>
		{/if}
	</div>
</FloatingPanel>

<style>
	.fg-bg-wrapper {
		--fgbg-size: 44px;
		--fgbg-swatch-size: 28px;
		--fgbg-border-color: var(--pebble-panel-border);
		--fgbg-swatch-radius: 6px;
		--fgbg-swap-size: 20px;
		--fgbg-swap-inset: -2px;
		--fgbg-swap-radius: 50%;
		--fgbg-swap-bg: var(--pebble-panel-bg);
		--fgbg-swap-border-width: 1px;
		--fgbg-swap-color: var(--pebble-text-primary);
		--fgbg-swap-hover-bg: rgba(0, 0, 0, 0.05);
	}

	.separator {
		width: 1px;
		height: 44px;
		background: var(--pebble-panel-border);
		margin: 0 4px;
	}

	.preset-grid {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.preset-row {
		display: flex;
		gap: 8px;
	}

	.picker-anchor {
		position: relative;
	}

	.picker-button {
		width: 32px;
		height: 32px;
		padding: 0;
		border: 1px solid var(--pebble-panel-border);
		border-radius: 8px;
		cursor: pointer;
	}

	.picker-popup {
		position: absolute;
		bottom: calc(100% + 8px);
		right: 0;
		background: var(--pebble-panel-bg);
		border: 1px solid var(--pebble-panel-border);
		border-radius: var(--pebble-panel-radius);
		box-shadow: var(--pebble-panel-shadow);
		color: var(--pebble-text-primary);
		z-index: 10;

		--picker-border-radius: 4px;
		--picker-input-border: var(--pebble-panel-border);
		--picker-input-bg: rgba(0, 0, 0, 0.05);
		--picker-ring: var(--pebble-accent);
		--picker-error: oklch(0.55 0.2 25);
	}
</style>
