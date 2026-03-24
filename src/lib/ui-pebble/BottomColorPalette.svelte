<script lang="ts">
	import { PEBBLE_PALETTE } from './pebble-palette-data';
	import FloatingPanel from './FloatingPanel.svelte';
	import PebbleSwatch from './PebbleSwatch.svelte';
	import ColorPickerPopup from '$lib/color-picker/ColorPickerPopup.svelte';

	interface Props {
		selectedColor: string;
		onColorChange: (hex: string) => void;
	}

	let { selectedColor, onColorChange }: Props = $props();

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
	<PebbleSwatch
		color={selectedColor}
		selected
		size="lg"
	/>

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

		--picker-input-border: var(--pebble-panel-border);
		--picker-input-bg: rgba(0, 0, 0, 0.05);
		--picker-ring: var(--pebble-accent);
		--picker-error: oklch(0.55 0.2 25);
	}
</style>
