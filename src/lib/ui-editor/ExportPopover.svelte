<script lang="ts">
	import { Download, ChevronDown } from 'lucide-svelte';
	import * as m from '$lib/paraglide/messages';
	import { clickOutside } from '$lib/click-outside';
	import {
		availableFormats,
		generateDefaultStem,
		type ExportFormat
	} from '$lib/canvas/export';

	interface Props {
		canvasWidth: number;
		canvasHeight: number;
		onExport: (format: ExportFormat, filenameStem: string) => void;
		onClose: () => void;
		excludeElements?: HTMLElement[];
	}

	let {
		canvasWidth,
		canvasHeight,
		onExport,
		onClose,
		excludeElements = []
	}: Props = $props();

	let selectedFormatId = $state(availableFormats[0].id);
	let filenameStem = $state('');

	const selectedFormat = $derived(
		availableFormats.find((f) => f.id === selectedFormatId) ?? availableFormats[0]
	);

	const defaultStem = $derived(
		generateDefaultStem({ width: canvasWidth, height: canvasHeight })
	);

	function handleExport() {
		onExport(selectedFormat, filenameStem);
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			onClose();
		}
	}
</script>

<svelte:window onkeydown={handleKeyDown} />

<div class="export-popover" use:clickOutside={{ onClose, exclude: excludeElements }}>
	<div class="field">
		<label class="field-label" for="export-format">{m.label_format()}</label>
		<div class="select-wrapper">
			<select id="export-format" class="format-select" bind:value={selectedFormatId}>
				{#each availableFormats as format}
					<option value={format.id}>{format.label}</option>
				{/each}
			</select>
			<ChevronDown size={14} class="select-chevron" />
		</div>
	</div>

	<div class="field">
		<label class="field-label" for="export-filename">{m.label_filename()}</label>
		<input
			id="export-filename"
			type="text"
			class="filename-input"
			placeholder={defaultStem}
			bind:value={filenameStem}
		/>
	</div>

	<button class="export-confirm-btn" onclick={handleExport}>
		<Download size={14} />
		<span>{m.action_exportFormat({ format: selectedFormat.label })}</span>
	</button>
</div>

<style>
	.export-popover {
		position: absolute;
		top: 100%;
		right: 0;
		margin-top: var(--ds-space-2);
		width: 300px;
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 16px;
		background: var(--ds-bg-elevated);
		border: 1px solid var(--ds-border-subtle);
		border-radius: 8px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
		z-index: 100;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.field-label {
		font-family: var(--ds-font-body);
		font-size: 12px;
		font-weight: 600;
		color: var(--ds-text-secondary);
	}

	.select-wrapper {
		position: relative;
		display: flex;
		align-items: center;
	}

	.format-select {
		width: 100%;
		height: 32px;
		padding: 0 32px 0 12px;
		border: 1px solid var(--ds-border);
		border-radius: 6px;
		background: var(--ds-bg-surface);
		color: var(--ds-text-primary);
		font-family: var(--ds-font-body);
		font-size: 13px;
		cursor: pointer;
		appearance: none;
		outline: none;
	}

	.format-select:focus {
		border-color: var(--ds-accent);
	}

	.select-wrapper :global(.select-chevron) {
		position: absolute;
		right: 12px;
		pointer-events: none;
		color: var(--ds-text-tertiary);
	}

	.filename-input {
		width: 100%;
		height: 32px;
		padding: 0 12px;
		border: 1px solid var(--ds-border);
		border-radius: 6px;
		background: var(--ds-bg-surface);
		color: var(--ds-text-primary);
		font-family: var(--ds-font-body);
		font-size: 13px;
		outline: none;
		box-sizing: border-box;
	}

	.filename-input::placeholder {
		color: var(--ds-text-tertiary);
	}

	.filename-input:focus {
		border-color: var(--ds-accent);
	}

	.export-confirm-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		width: 100%;
		height: 36px;
		border: none;
		border-radius: 6px;
		background: var(--ds-accent);
		color: #ffffff;
		font-family: var(--ds-font-body);
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
	}

	.export-confirm-btn:hover {
		background: color-mix(in srgb, var(--ds-accent) 85%, black);
	}
</style>
