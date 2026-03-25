<script lang="ts">
	import { PEBBLE_PALETTE } from './pebble-palette-data';
	import FloatingPanel from './FloatingPanel.svelte';
	import PebbleSwatch from './PebbleSwatch.svelte';
	import ColorPickerPopup from '$lib/color-picker/ColorPickerPopup.svelte';

	interface Props {
		selectedColor: string;
		backgroundColor?: string;
		onColorChange: (hex: string) => void;
		onSwapColors?: () => void;
	}

	let { selectedColor, backgroundColor = '#ffffff', onColorChange, onSwapColors }: Props = $props();

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
	<div class="fg-bg-preview">
		<div class="swatch-bg checkerboard">
			<div class="swatch-color" style:background-color={backgroundColor}></div>
		</div>
		<div class="swatch-fg checkerboard">
			<div class="swatch-color" style:background-color={selectedColor}></div>
		</div>
		{#if onSwapColors}
			<button
				class="swap-button"
				aria-label="Swap foreground and background colors"
				onclick={onSwapColors}
			>
				<svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
					<path d="M1 4h8L7 2M11 8H3l2 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
				</svg>
			</button>
		{/if}
	</div>

	<div class="separator"></div>

	<div class="preset-grid">
		{#each PEBBLE_PALETTE as row}
			<div class="preset-row">
				{#each row as color}
					<PebbleSwatch
						{color}
						selected={color.toUpperCase() === selectedColor.toUpperCase()}
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
			style:background-color={selectedColor}
			title="Custom color"
			onclick={() => (isPickerOpen = !isPickerOpen)}
		></button>

		{#if isPickerOpen}
			<div class="picker-popup">
				<ColorPickerPopup
					{selectedColor}
					{onColorChange}
					onClose={() => (isPickerOpen = false)}
				/>
			</div>
		{/if}
	</div>
</FloatingPanel>

<style>
	.fg-bg-preview {
		position: relative;
		width: 44px;
		height: 44px;
		flex-shrink: 0;
	}

	.checkerboard {
		background-image:
			linear-gradient(45deg, #ccc 25%, transparent 25%),
			linear-gradient(-45deg, #ccc 25%, transparent 25%),
			linear-gradient(45deg, transparent 75%, #ccc 75%),
			linear-gradient(-45deg, transparent 75%, #ccc 75%);
		background-size: 8px 8px;
		background-position: 0 0, 0 4px, 4px -4px, -4px 0;
	}

	.swatch-color {
		width: 100%;
		height: 100%;
	}

	.swatch-fg {
		position: absolute;
		top: 0;
		left: 0;
		width: 28px;
		height: 28px;
		border-radius: 6px;
		overflow: hidden;
		border: 1px solid var(--pebble-panel-border);
		z-index: 1;
	}

	.swatch-bg {
		position: absolute;
		bottom: 0;
		right: 0;
		width: 28px;
		height: 28px;
		border-radius: 6px;
		overflow: hidden;
		border: 1px solid var(--pebble-panel-border);
	}

	.swap-button {
		position: absolute;
		top: -2px;
		right: -2px;
		width: 20px;
		height: 20px;
		padding: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--pebble-panel-bg);
		border: 1px solid var(--pebble-panel-border);
		border-radius: 50%;
		color: var(--pebble-text-primary);
		cursor: pointer;
		z-index: 2;
		transition: background 0.12s ease;
	}

	.swap-button:hover {
		background: rgba(0, 0, 0, 0.05);
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
