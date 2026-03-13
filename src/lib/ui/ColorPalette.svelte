<script lang="ts">
	import { isValidHex } from '$lib/canvas/color';
	import { DEFAULT_PALETTE } from './color-palette-data';
	import PixelPanel from './PixelPanel.svelte';
	import ColorSwatch from './ColorSwatch.svelte';

	interface Props {
		selectedColor: string;
		recentColors?: string[];
		onColorChange: (color: string) => void;
	}

	let { selectedColor, recentColors = [], onColorChange }: Props = $props();

	let hexInput = $state('');
	let isHexValid = $state(true);

	$effect.pre(() => {
		hexInput = selectedColor;
		isHexValid = true;
	});

	function handleHexInput(event: Event): void {
		const input = event.currentTarget as HTMLInputElement;
		let value = input.value;

		if (!value.startsWith('#')) {
			value = '#' + value;
		}
		value = value.slice(0, 7);
		input.value = value;

		hexInput = value;
		isHexValid = isValidHex(value);
	}

	function commitHexInput(): void {
		if (isValidHex(hexInput)) {
			const normalized = hexInput.toLowerCase();
			if (normalized !== selectedColor.toLowerCase()) {
				onColorChange(normalized);
			}
		} else {
			hexInput = selectedColor;
			isHexValid = true;
		}
	}

	function handleHexKeyDown(event: KeyboardEvent): void {
		if (event.key === 'Enter') {
			commitHexInput();
		}
	}

	function handleNativeColorInput(event: Event): void {
		const input = event.currentTarget as HTMLInputElement;
		onColorChange(input.value);
	}
</script>

<PixelPanel>
	<div class="color-palette">
		<div class="current-color">
			<div class="preview-box" style:background-color={selectedColor}></div>
			<span class="hex-label">{selectedColor}</span>
		</div>

		<div class="color-input">
			<input
				type="color"
				class="native-picker"
				value={selectedColor}
				aria-label="Color picker"
				oninput={handleNativeColorInput}
			/>
			<input
				type="text"
				class="hex-field"
				class:hex-field--invalid={!isHexValid}
				value={hexInput}
				maxlength="7"
				aria-label="Hex color code"
				aria-invalid={!isHexValid}
				oninput={handleHexInput}
				onblur={commitHexInput}
				onkeydown={handleHexKeyDown}
			/>
		</div>

		<div class="palette-grid">
			{#each DEFAULT_PALETTE as color}
				<ColorSwatch
					{color}
					size="sm"
					selected={color.toLowerCase() === selectedColor.toLowerCase()}
					onclick={() => onColorChange(color)}
				/>
			{/each}
		</div>

		{#if recentColors.length > 0}
			<div class="recent-colors">
				<span class="section-label">Recent</span>
				<div class="recent-list">
					{#each recentColors as color}
						<ColorSwatch
							{color}
							size="sm"
							selected={color.toLowerCase() === selectedColor.toLowerCase()}
							onclick={() => onColorChange(color)}
						/>
					{/each}
				</div>
			</div>
		{/if}
	</div>
</PixelPanel>

<style>
	.color-palette {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		width: fit-content;
	}

	/* ── Current color preview ── */

	.current-color {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}

	.preview-box {
		--depth: calc((var(--border-width) + var(--border-width-thick)) / 2);
		width: 40px;
		height: 40px;
		border: var(--border-width) solid var(--color-border-shadow);
		border-bottom-width: var(--depth);
		border-right-width: var(--depth);
		flex-shrink: 0;
	}

	.hex-label {
		font-family: var(--font-mono);
		font-size: 14px;
		color: var(--color-surface-fg);
		text-transform: lowercase;
	}

	/* ── Color input row ── */

	.color-input {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.native-picker {
		width: 28px;
		height: 28px;
		padding: 1px;
		border: var(--border-width) solid var(--color-border-shadow);
		background: var(--color-input);
		cursor: pointer;
		flex-shrink: 0;
	}

	.hex-field {
		width: 80px;
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
	}

	.hex-field:focus {
		outline: 2px solid var(--color-ring);
		outline-offset: -1px;
	}

	.hex-field--invalid {
		border-color: var(--color-destructive);
	}

	/* ── Palette grid ── */

	.palette-grid {
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		gap: var(--space-1);
	}

	/* ── Recent colors ── */

	.recent-colors {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.section-label {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--color-muted-fg);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.recent-list {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
	}
</style>
