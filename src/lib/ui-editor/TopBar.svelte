<script lang="ts">
	import {
		Minus,
		Plus,
		Maximize2,
		Grid3X3,
		Download,
		FolderOpen
	} from 'lucide-svelte';
	import * as m from '$lib/paraglide/messages';
	import { tooltip } from '$lib/tooltip';
	import ExportPopover from './ExportPopover.svelte';
	import PixelPerfectIcon from './PixelPerfectIcon.svelte';
	import type { ExportFormat } from '$lib/canvas/export';

	interface Props {
		zoomPercent: number;
		showGrid: boolean;
		pixelPerfect: boolean;
		pixelPerfectDisabled: boolean;
		isExportOpen: boolean;
		canvasWidth: number;
		canvasHeight: number;
		onZoomIn: () => void;
		onZoomOut: () => void;
		onZoomReset: () => void;
		onFit: () => void;
		onGridToggle: () => void;
		onPixelPerfectToggle: () => void;
		onExportToggle: () => void;
		onExportConfirm: (format: ExportFormat, filenameStem: string) => void;
		onBrowseSavedWork: () => void;
		isBrowserOpen?: boolean;
	}

	let {
		zoomPercent,
		showGrid,
		pixelPerfect,
		pixelPerfectDisabled,
		isExportOpen,
		canvasWidth,
		canvasHeight,
		onZoomIn,
		onZoomOut,
		onZoomReset,
		onFit,
		onGridToggle,
		onPixelPerfectToggle,
		onExportToggle,
		onExportConfirm,
		onBrowseSavedWork,
		isBrowserOpen = false
	}: Props = $props();

	const ppLabel = $derived(
		pixelPerfectDisabled
			? m.action_pixelPerfectDisabled()
			: pixelPerfect
				? m.action_pixelPerfectOn()
				: m.action_pixelPerfectOff()
	);

	function handlePixelPerfectClick() {
		if (pixelPerfectDisabled) return;
		onPixelPerfectToggle();
	}

	let exportBtnEl = $state<HTMLButtonElement>();
</script>

<header class="top-bar">
	<div class="logo-area">
		<a href="/" class="logo-link" aria-label="Home">
			<img src="/apple-touch-icon.png" alt="" width="24" height="24" class="logo-icon" />
		</a>
	</div>

	<div class="actions">
		<div class="zoom-controls">
			<button class="zoom-btn" onclick={onZoomOut} aria-label={m.action_zoomOut()} use:tooltip={m.action_zoomOut()}>
				<Minus size={14} />
			</button>
			<button class="zoom-label" onclick={onZoomReset} aria-label={m.action_resetZoom()} use:tooltip={m.action_resetZoom()}>
				{zoomPercent}%
			</button>
			<button class="zoom-btn" onclick={onZoomIn} aria-label={m.action_zoomIn()} use:tooltip={m.action_zoomIn()}>
				<Plus size={14} />
			</button>
			<button class="zoom-btn" onclick={onFit} aria-label={m.action_fitToView()} use:tooltip={m.action_fitToView()}>
				<Maximize2 size={14} />
			</button>
		</div>

		<button
			class="toolbar-btn"
			class:is-on={pixelPerfect && !pixelPerfectDisabled}
			class:is-disabled={pixelPerfectDisabled}
			onclick={handlePixelPerfectClick}
			aria-label={ppLabel}
			aria-pressed={pixelPerfect}
			aria-disabled={pixelPerfectDisabled || undefined}
			use:tooltip={ppLabel}
		>
			<PixelPerfectIcon size={16} />
		</button>

		<button
			class="toolbar-btn"
			class:is-on={showGrid}
			onclick={onGridToggle}
			aria-label={m.action_toggleGrid()}
			aria-pressed={showGrid}
			use:tooltip={`${m.action_toggleGrid()} (G)`}
		>
			<Grid3X3 size={16} />
		</button>

		<button
			class="toolbar-btn"
			class:is-on={isBrowserOpen}
			onclick={onBrowseSavedWork}
			aria-label={m.label_savedWorks()}
			aria-haspopup="dialog"
			aria-expanded={isBrowserOpen}
			use:tooltip={m.label_savedWorks()}
		>
			<FolderOpen size={16} />
		</button>

		<div class="export-wrapper">
			<button
				bind:this={exportBtnEl}
				class="toolbar-btn toolbar-btn--accent export-btn"
				class:is-on={isExportOpen}
				onclick={onExportToggle}
				aria-label={m.label_export()}
				aria-expanded={isExportOpen}
				use:tooltip={m.label_export()}
			>
				<Download size={14} />
				<span>{m.label_export()}</span>
			</button>

			{#if isExportOpen}
				<ExportPopover
					{canvasWidth}
					{canvasHeight}
					onExport={onExportConfirm}
					onClose={onExportToggle}
					excludeElements={exportBtnEl ? [exportBtnEl] : []}
				/>
			{/if}
		</div>
	</div>
</header>

<style>
	.top-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: env(safe-area-inset-top, 0px) var(--ds-space-5) 0;
		background: var(--ds-bg-surface);
		border-bottom: 1px solid var(--ds-border-subtle);
	}

	.logo-link {
		display: flex;
		align-items: center;
	}

	.logo-icon {
		border-radius: 4px;
	}

	.actions {
		--tbar-btn-size: 32px;
		--tbar-btn-radius: var(--ds-radius-sm);
		display: flex;
		align-items: center;
		gap: var(--ds-space-4);
	}

	.zoom-controls {
		display: flex;
		align-items: center;
		background: var(--ds-bg-hover);
		border-radius: var(--ds-radius-sm);
		height: 32px;
		padding: 0 4px;
	}

	.zoom-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border: none;
		background: none;
		border-radius: 4px;
		color: var(--ds-text-secondary);
		cursor: pointer;
		padding: 0;
	}

	.zoom-btn:hover {
		background: var(--ds-bg-active);
	}

	.zoom-label {
		border: none;
		background: none;
		font-family: var(--ds-font-body);
		font-size: var(--ds-font-size-sm);
		color: var(--ds-text-primary);
		cursor: pointer;
		padding: 0 4px;
		white-space: nowrap;
	}

	.export-wrapper {
		position: relative;
	}

	/* Export keeps the labeled form on desktop: auto width + padding + gap. */
	.export-btn {
		width: auto;
		gap: 6px;
		padding: 0 12px;
		font-family: var(--ds-font-body);
		font-size: var(--ds-font-size-sm);
	}

	@media (min-width: 1024px) and (max-width: 1439px) {
		.actions {
			--tbar-btn-size: 36px;
		}

		.zoom-controls {
			height: 36px;
		}
	}
</style>
