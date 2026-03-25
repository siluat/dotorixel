<script lang="ts">
	import { isValidHex } from '$lib/canvas/color';
	import { DEFAULT_PALETTE } from './color-palette-data';
	import PixelPanel from './PixelPanel.svelte';
	import ColorSwatch from './ColorSwatchTinted.svelte';
	import ColorPickerPopup from '$lib/color-picker/ColorPickerPopup.svelte';

	interface Props {
		selectedColor: string;
		backgroundColor?: string;
		recentColors?: string[];
		onColorChange: (color: string) => void;
		onSwapColors?: () => void;
	}

	let { selectedColor, backgroundColor = '#ffffff', recentColors = [], onColorChange, onSwapColors }: Props = $props();

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
</script>

<PixelPanel>
	<div class="color-palette">
		<div class="current-color">
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
			<span class="hex-label">{selectedColor}</span>
		</div>

		<div class="color-input">
			<div class="picker-anchor" bind:this={anchorEl}>
				<button
					class="picker-button"
					style:background-color={selectedColor}
					aria-label="Color picker"
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

	.fg-bg-preview {
		position: relative;
		width: 50px;
		height: 50px;
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
		--depth: calc((var(--border-width) + var(--border-width-thick)) / 2);
		position: absolute;
		top: 0;
		left: 0;
		width: 30px;
		height: 30px;
		border: var(--border-width) solid var(--color-border-shadow);
		border-bottom-width: var(--depth);
		border-right-width: var(--depth);
		z-index: 1;
	}

	.swatch-bg {
		--depth: calc((var(--border-width) + var(--border-width-thick)) / 2);
		position: absolute;
		bottom: 0;
		right: 0;
		width: 30px;
		height: 30px;
		border: var(--border-width) solid var(--color-border-shadow);
		border-bottom-width: var(--depth);
		border-right-width: var(--depth);
	}

	.swap-button {
		position: absolute;
		top: 0;
		right: 0;
		width: 18px;
		height: 18px;
		padding: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--color-surface);
		border: var(--border-width) solid var(--color-border-shadow);
		color: var(--color-surface-fg);
		cursor: pointer;
		z-index: 2;
	}

	.swap-button:hover {
		background: var(--color-muted);
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
