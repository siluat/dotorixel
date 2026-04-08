<script lang="ts">
	import { Drawer } from 'vaul-svelte';
	import { Download, ChevronDown } from 'lucide-svelte';
	import * as m from '$lib/paraglide/messages';
	import {
		availableFormats,
		generateDefaultStem,
		type ExportFormat
	} from '$lib/canvas/export';

	interface Props {
		open: boolean;
		canvasWidth: number;
		canvasHeight: number;
		onOpenChange: (open: boolean) => void;
		onExport: (format: ExportFormat, filenameStem: string) => void;
	}

	let {
		open,
		canvasWidth,
		canvasHeight,
		onOpenChange,
		onExport
	}: Props = $props();

	// Local open state decoupled from parent prop.
	// Opening syncs immediately; closing is delayed so
	// vaul-svelte can finish its slide-down animation
	// before bits-ui removes the element from the DOM.
	let drawerOpen = $state(false);
	const CLOSE_ANIMATION_MS = 500;

	$effect(() => {
		if (open) {
			drawerOpen = true;
		} else if (drawerOpen) {
			drawerOpen = false;
			selectedFormatId = availableFormats[0].id;
			filenameStem = '';
		}
	});

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

	function handleOpenChange(isOpen: boolean) {
		if (isOpen) {
			drawerOpen = true;
			onOpenChange(true);
		} else {
			selectedFormatId = availableFormats[0].id;
			filenameStem = '';
			setTimeout(() => {
				drawerOpen = false;
				onOpenChange(false);
			}, CLOSE_ANIMATION_MS);
		}
	}
</script>

<Drawer.Root open={drawerOpen} onOpenChange={handleOpenChange}>
	<Drawer.Portal>
		<Drawer.Overlay class="export-sheet-overlay" />
		<Drawer.Content class="export-sheet-content">
			<div class="drag-handle"></div>
			<Drawer.Title class="export-sheet-title">{m.label_export()}</Drawer.Title>

			<div class="export-sheet-body">
				<div class="field">
					<label class="field-label" for="export-format-mobile">{m.label_format()}</label>
					<div class="select-wrapper">
						<select id="export-format-mobile" class="format-select" bind:value={selectedFormatId}>
							{#each availableFormats as format}
								<option value={format.id}>{format.label}</option>
							{/each}
						</select>
						<ChevronDown size={14} class="select-chevron" />
					</div>
				</div>

				<div class="field">
					<label class="field-label" for="export-filename-mobile">{m.label_filename()}</label>
					<input
						id="export-filename-mobile"
						type="text"
						class="filename-input"
						placeholder={defaultStem}
						bind:value={filenameStem}
					/>
				</div>

				<button class="export-confirm-btn" onclick={handleExport}>
					<Download size={16} />
					<span>{m.action_exportFormat({ format: selectedFormat.label })}</span>
				</button>
			</div>
		</Drawer.Content>
	</Drawer.Portal>
</Drawer.Root>

<style>
	:global(.export-sheet-overlay) {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.4);
		z-index: 200;
		animation: sheet-fade-in 0.5s cubic-bezier(0.32, 0.72, 0, 1);
	}

	:global(.export-sheet-content) {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		z-index: 201;
		display: flex;
		flex-direction: column;
		background: var(--ds-bg-elevated);
		border-radius: 16px 16px 0 0;
		padding-bottom: max(16px, env(safe-area-inset-bottom, 0px));
		animation: sheet-slide-up 0.5s cubic-bezier(0.32, 0.72, 0, 1);
	}

	@keyframes sheet-slide-up {
		from {
			transform: translate3d(0, 100%, 0);
		}
	}

	@keyframes sheet-fade-in {
		from {
			opacity: 0;
		}
	}

	:global(.export-sheet-title) {
		margin: 0;
		padding: 0 20px;
		font-family: var(--ds-font-body);
		font-size: 16px;
		font-weight: 600;
		color: var(--ds-text-primary);
	}

	.drag-handle {
		width: 36px;
		height: 4px;
		margin: 12px auto 16px;
		border-radius: 2px;
		background: var(--ds-border);
		flex-shrink: 0;
	}

	.export-sheet-body {
		display: flex;
		flex-direction: column;
		gap: 16px;
		padding: 16px 20px 0;
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
		height: var(--ds-touch-target-min);
		padding: 0 40px 0 16px;
		border: 1px solid var(--ds-border);
		border-radius: 8px;
		background: var(--ds-bg-surface);
		color: var(--ds-text-primary);
		font-family: var(--ds-font-body);
		font-size: 15px;
		cursor: pointer;
		appearance: none;
		outline: none;
	}

	.format-select:focus {
		border-color: var(--ds-accent);
	}

	.select-wrapper :global(.select-chevron) {
		position: absolute;
		right: 14px;
		pointer-events: none;
		color: var(--ds-text-tertiary);
	}

	.filename-input {
		width: 100%;
		height: var(--ds-touch-target-min);
		padding: 0 16px;
		border: 1px solid var(--ds-border);
		border-radius: 8px;
		background: var(--ds-bg-surface);
		color: var(--ds-text-primary);
		font-family: var(--ds-font-body);
		font-size: 15px;
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
		gap: 8px;
		width: 100%;
		height: var(--ds-touch-target-min);
		border: none;
		border-radius: 8px;
		background: var(--ds-accent);
		color: #ffffff;
		font-family: var(--ds-font-body);
		font-size: 15px;
		font-weight: 600;
		cursor: pointer;
	}

	.export-confirm-btn:hover {
		background: color-mix(in srgb, var(--ds-accent) 85%, black);
	}
</style>
