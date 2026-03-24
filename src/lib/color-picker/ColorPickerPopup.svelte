<script lang="ts">
	import { isValidHex } from '$lib/canvas/color';
	import HsvPicker from './HsvPicker.svelte';

	interface Props {
		selectedColor: string;
		onColorChange: (hex: string) => void;
		onClose: () => void;
	}

	let { selectedColor, onColorChange, onClose }: Props = $props();

	let hexInput = $state('');
	let isHexValid = $state(true);

	$effect(() => {
		hexInput = selectedColor;
		isHexValid = true;
	});

	function handleHexInput(e: Event): void {
		const input = e.currentTarget as HTMLInputElement;
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

	function handleHexKeyDown(e: KeyboardEvent): void {
		if (e.key === 'Enter') {
			commitHexInput();
		}
	}

	function handleKeyDown(e: KeyboardEvent): void {
		if (e.key === 'Escape') {
			onClose();
		}
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
	class="color-picker-popup"
	role="dialog"
	aria-label="Color picker"
	tabindex="-1"
	onkeydown={handleKeyDown}
>
	<HsvPicker {selectedColor} {onColorChange} />

	<div class="hex-row">
		<span class="hex-label">HEX</span>
		<input
			type="text"
			class="hex-input"
			class:hex-input--invalid={!isHexValid}
			value={hexInput}
			maxlength="7"
			aria-label="Hex color code"
			aria-invalid={!isHexValid}
			oninput={handleHexInput}
			onblur={commitHexInput}
			onkeydown={handleHexKeyDown}
		/>
	</div>
</div>

<style>
	.color-picker-popup {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 12px;
	}

	.hex-row {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.hex-label {
		font-size: 11px;
		font-weight: 600;
		opacity: 0.7;
	}

	.hex-input {
		flex: 1;
		height: 24px;
		padding: 0 6px;
		font-family: inherit;
		font-size: 12px;
		border: 1px solid var(--picker-input-border, currentColor);
		border-radius: 0;
		background: var(--picker-input-bg, transparent);
		color: inherit;
	}

	.hex-input:focus {
		outline: 2px solid var(--picker-ring, currentColor);
		outline-offset: -1px;
	}

	.hex-input--invalid {
		border-color: var(--picker-error, #e53935);
	}
</style>
