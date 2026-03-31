<script lang="ts">
	import {
		Minus,
		Plus,
		Maximize2,
		Grid3X3,
		Download
	} from 'lucide-svelte';
	import * as m from '$lib/paraglide/messages';

	interface Props {
		zoomPercent: number;
		showGrid: boolean;
		onZoomIn: () => void;
		onZoomOut: () => void;
		onZoomReset: () => void;
		onFit: () => void;
		onGridToggle: () => void;
		onExport: () => void;
	}

	let {
		zoomPercent,
		showGrid,
		onZoomIn,
		onZoomOut,
		onZoomReset,
		onFit,
		onGridToggle,
		onExport
	}: Props = $props();
</script>

<header class="top-bar">
	<div class="logo-area">
		<a href="/" class="logo-link" aria-label="Home">
			<img src="/apple-touch-icon.png" alt="" width="24" height="24" class="logo-icon" />
		</a>
	</div>

	<div class="actions">
		<div class="zoom-controls">
			<button class="zoom-btn" onclick={onZoomOut} aria-label={m.action_zoomOut()}>
				<Minus size={14} />
			</button>
			<button class="zoom-label" onclick={onZoomReset} aria-label={m.action_resetZoom()}>
				{zoomPercent}%
			</button>
			<button class="zoom-btn" onclick={onZoomIn} aria-label={m.action_zoomIn()}>
				<Plus size={14} />
			</button>
			<button class="zoom-btn" onclick={onFit} aria-label={m.action_fitToView()}>
				<Maximize2 size={14} />
			</button>
		</div>

		<button
			class="icon-btn"
			class:active={showGrid}
			onclick={onGridToggle}
			aria-label={m.action_toggleGrid()}
			aria-pressed={showGrid}
		>
			<Grid3X3 size={16} />
		</button>

		<button class="export-btn" onclick={onExport} aria-label={m.action_exportPng()}>
			<Download size={14} />
			<span>{m.label_export()}</span>
		</button>
	</div>
</header>

<style>
	.top-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 var(--ds-space-5);
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
</style>
