<script lang="ts">
	import { PEBBLE_PALETTE } from './pebble-palette-data';
	import FloatingPanel from './FloatingPanel.svelte';
	import PebbleSwatch from './PebbleSwatch.svelte';

	interface Props {
		selectedColor: string;
		onColorChange: (hex: string) => void;
	}

	let { selectedColor, onColorChange }: Props = $props();

	let pickerValue = $derived(selectedColor);
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

	<input
		type="color"
		class="color-picker"
		value={pickerValue}
		oninput={(e) => onColorChange(e.currentTarget.value.toUpperCase())}
		title="Custom color"
	/>
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

	.color-picker {
		width: 32px;
		height: 32px;
		padding: 0;
		border: 1px solid var(--pebble-panel-border);
		border-radius: 8px;
		background: none;
		cursor: pointer;
	}

	.color-picker::-webkit-color-swatch-wrapper {
		padding: 2px;
	}

	.color-picker::-webkit-color-swatch {
		border: none;
		border-radius: 5px;
	}
</style>
