<script lang="ts">
	import { isValidHex } from '$lib/canvas/color';
	import { DEFAULT_PALETTE } from './color-palette-data';
	import PixelPanel from './PixelPanel.svelte';
	import ColorSwatch from './ColorSwatchTinted.svelte';
	import ColorPickerPopup from '$lib/color-picker/ColorPickerPopup.svelte';
	import FgBgPreview from '$lib/color-picker/FgBgPreview.svelte';

	interface Props {
		foregroundColor: string;
		backgroundColor?: string;
		recentColors?: string[];
		onColorChange: (color: string) => void;
		onSwapColors?: () => void;
	}

	let { foregroundColor, backgroundColor = '#ffffff', recentColors = [], onColorChange, onSwapColors }: Props = $props();

	let hexInput = $state('');
	let isHexValid = $state(true);
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

	$effect.pre(() => {
		hexInput = foregroundColor;
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
			if (normalized !== foregroundColor.toLowerCase()) {
				onColorChange(normalized);
			}
		} else {
			hexInput = foregroundColor;
			isHexValid = true;
		}
	}

	function handleHexKeyDown(event: KeyboardEvent): void {
		if (event.key === 'Enter') {
			commitHexInput();
		}
	}
</script>

<PixelPanel>
	<div class="color-palette">
		<div class="current-color">
			<FgBgPreview {foregroundColor} {backgroundColor} {onSwapColors} />
			<span class="hex-label">{foregroundColor}</span>
		</div>

		<div class="color-input">
			<div class="picker-anchor" bind:this={anchorEl}>
				<button
					class="picker-button"
					style:background-color={foregroundColor}
					aria-label="Color picker"
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
					selected={color.toLowerCase() === foregroundColor.toLowerCase()}
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
							selected={color.toLowerCase() === foregroundColor.toLowerCase()}
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
		--_depth: calc((var(--border-width) + var(--border-width-thick)) / 2);

		display: flex;
		align-items: center;
		gap: var(--space-3);

		--fgbg-size: 50px;
		--fgbg-swatch-size: 30px;
		--fgbg-border-color: var(--color-border-shadow);
		--fgbg-swatch-border-width: var(--border-width) var(--_depth) var(--_depth) var(--border-width);
		--fgbg-swap-size: 18px;
		--fgbg-swap-bg: var(--color-surface);
		--fgbg-swap-border-width: var(--border-width);
		--fgbg-swap-color: var(--color-surface-fg);
		--fgbg-swap-hover-bg: var(--color-muted);
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

	.picker-anchor {
		position: relative;
	}

	.picker-button {
		width: 28px;
		height: 28px;
		padding: 0;
		border: var(--border-width) solid var(--color-border-shadow);
		background: var(--color-input);
		cursor: pointer;
		flex-shrink: 0;
	}

	.picker-popup {
		position: absolute;
		top: calc(100% + 4px);
		left: 0;
		background: var(--color-surface);
		border: var(--border-width) solid var(--color-border);
		border-top-color: var(--color-border-highlight);
		border-left-color: var(--color-border-highlight);
		border-bottom-color: var(--color-border-shadow);
		border-right-color: var(--color-border-shadow);
		color: var(--color-surface-fg);
		font-family: var(--font-mono);
		z-index: 10;

		--picker-input-border: var(--color-border-shadow);
		--picker-input-bg: var(--color-input);
		--picker-ring: var(--color-ring);
		--picker-error: var(--color-destructive);
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
