<script lang="ts">
	import { EDITOR_PALETTE } from './editor-palette-data';
	import FloatingPanel from './FloatingPanel.svelte';
	import EditorSwatch from './EditorSwatch.svelte';
	import ColorPickerPopup from '$lib/color-picker/ColorPickerPopup.svelte';
	import FgBgPreview from '$lib/color-picker/FgBgPreview.svelte';

	type PickerTarget = 'fg' | 'bg';

	interface Props {
		foregroundColor: string;
		backgroundColor?: string;
		onForegroundColorChange: (hex: string) => void;
		onBackgroundColorChange?: (hex: string) => void;
		onSwapColors?: () => void;
	}

	let { foregroundColor, backgroundColor = '#ffffff', onForegroundColorChange, onBackgroundColorChange, onSwapColors }: Props = $props();

	let pickerTarget: PickerTarget | null = $state(null);
	let anchorEl: HTMLElement | undefined = $state();

	$effect(() => {
		if (pickerTarget === null) return;
		function handleOutsidePointerDown(e: PointerEvent): void {
			if (anchorEl && !anchorEl.contains(e.target as Node)) {
				pickerTarget = null;
			}
		}
		document.addEventListener('pointerdown', handleOutsidePointerDown);
		return () => document.removeEventListener('pointerdown', handleOutsidePointerDown);
	});

	function togglePicker(target: PickerTarget): void {
		pickerTarget = pickerTarget === target ? null : target;
	}
</script>

<FloatingPanel style="height: 68px; border-radius: var(--ds-radius-lg); padding: 10px 16px;">
	<div class="fg-bg-wrapper" bind:this={anchorEl}>
		<FgBgPreview
			{foregroundColor}
			{backgroundColor}
			{onSwapColors}
			onForegroundClick={() => togglePicker('fg')}
			onBackgroundClick={onBackgroundColorChange ? () => togglePicker('bg') : undefined}
		/>

		{#if pickerTarget !== null}
			<div class="picker-popup">
				<ColorPickerPopup
					selectedColor={pickerTarget === 'fg' ? foregroundColor : backgroundColor}
					onColorChange={pickerTarget === 'fg' ? onForegroundColorChange : (onBackgroundColorChange ?? onForegroundColorChange)}
					onClose={() => (pickerTarget = null)}
				/>
			</div>
		{/if}
	</div>

	<div class="separator"></div>

	<div class="preset-grid">
		{#each EDITOR_PALETTE as row}
			<div class="preset-row">
				{#each row as color}
					<EditorSwatch
						{color}
						selected={color.toUpperCase() === foregroundColor.toUpperCase()}
						onclick={() => onForegroundColorChange(color)}
					/>
				{/each}
			</div>
		{/each}
	</div>
</FloatingPanel>

<style>
	.fg-bg-wrapper {
		position: relative;
		--fgbg-size: 44px;
		--fgbg-swatch-size: 28px;
		--fgbg-border-color: var(--ds-border);
		--fgbg-swatch-radius: var(--ds-radius-sm);
		--fgbg-swap-size: 20px;
		--fgbg-swap-inset: -2px;
		--fgbg-swap-radius: 50%;
		--fgbg-swap-bg: var(--ds-bg-elevated);
		--fgbg-swap-border-width: var(--ds-border-width);
		--fgbg-swap-color: var(--ds-text-primary);
		--fgbg-swap-hover-bg: rgba(0, 0, 0, 0.05);
	}

	.separator {
		width: 1px;
		height: 44px;
		background: var(--ds-border);
		margin: 0 var(--ds-space-2);
	}

	.preset-grid {
		display: flex;
		flex-direction: column;
		gap: var(--ds-space-3);
	}

	.preset-row {
		display: flex;
		gap: var(--ds-space-3);
	}

	.picker-popup {
		position: absolute;
		bottom: calc(100% + 8px);
		left: 0;
		background: var(--ds-bg-elevated);
		border: 1px solid var(--ds-border);
		border-radius: var(--ds-radius-lg);
		box-shadow: var(--ds-shadow-md);
		color: var(--ds-text-primary);
		z-index: 10;

		--picker-border-radius: 4px;
		--picker-input-border: var(--ds-border);
		--picker-input-bg: rgba(0, 0, 0, 0.05);
		--picker-ring: var(--ds-accent);
		--picker-error: oklch(0.55 0.2 25);
	}
</style>
