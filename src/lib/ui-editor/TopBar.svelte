<script lang="ts">
	import {
		Minus,
		Plus,
		Maximize2,
		Grid3X3,
		Download
	} from 'lucide-svelte';
	import * as m from '$lib/paraglide/messages';
	import { tooltip } from '$lib/tooltip';
	import ExportPopover from './ExportPopover.svelte';
	import type { ExportFormat } from '$lib/canvas/export';

	interface Props {
		zoomPercent: number;
		showGrid: boolean;
		isExportOpen: boolean;
		canvasWidth: number;
		canvasHeight: number;
		onZoomIn: () => void;
		onZoomOut: () => void;
		onZoomReset: () => void;
		onFit: () => void;
		onGridToggle: () => void;
		onExportToggle: () => void;
		onExportConfirm: (format: ExportFormat, filenameStem: string) => void;
	}

	let {
		zoomPercent,
		showGrid,
		isExportOpen,
		canvasWidth,
		canvasHeight,
		onZoomIn,
		onZoomOut,
		onZoomReset,
		onFit,
		onGridToggle,
		onExportToggle,
		onExportConfirm
	}: Props = $props();

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
			class="icon-btn"
			class:active={showGrid}
			onclick={onGridToggle}
			aria-label={m.action_toggleGrid()}
			aria-pressed={showGrid}
			use:tooltip={`${m.action_toggleGrid()} (G)`}
		>
			<Grid3X3 size={16} />
		</button>

		<div class="export-wrapper">
			<button
				bind:this={exportBtnEl}
				class="export-btn"
				class:export-btn--active={isExportOpen}
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

	@media (min-width: 1024px) and (max-width: 1439px) {
		.zoom-controls {
			height: 36px;
		}

		.icon-btn {
			width: 36px;
			height: 36px;
		}

		.export-btn {
			height: 36px;
		}
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

	.icon-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border: none;
		background: var(--ds-bg-hover);
		border-radius: var(--ds-radius-sm);
		color: var(--ds-text-secondary);
		cursor: pointer;
		padding: 0;
	}

	.icon-btn:hover {
		background: var(--ds-bg-active);
	}

	.icon-btn.active {
		color: var(--ds-accent);
	}

	.export-wrapper {
		position: relative;
	}

	.export-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		height: 32px;
		padding: 0 12px;
		border: none;
		background: var(--ds-accent);
		border-radius: var(--ds-radius-sm);
		color: #ffffff;
		font-family: var(--ds-font-body);
		font-size: var(--ds-font-size-sm);
		cursor: pointer;
	}

	.export-btn:hover {
		background: color-mix(in srgb, var(--ds-accent) 85%, black);
	}

	.export-btn--active {
		--export-btn-active-bg: #8a5d20;
		background: var(--export-btn-active-bg);
	}

	.export-btn--active:hover {
		background: var(--export-btn-active-bg);
	}
</style>
