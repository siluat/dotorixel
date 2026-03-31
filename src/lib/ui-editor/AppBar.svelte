<script lang="ts">
	import { Download, Grid3X3, Minus, Plus } from 'lucide-svelte';
	import * as m from '$lib/paraglide/messages';

	type MobileTab = 'draw' | 'colors' | 'settings';

	interface Props {
		activeTab: MobileTab;
		showGrid: boolean;
		zoomPercent: number;
		onGridToggle: () => void;
		onExport: () => void;
		onZoomIn: () => void;
		onZoomOut: () => void;
		onZoomReset: () => void;
	}

	let {
		activeTab,
		showGrid,
		zoomPercent,
		onGridToggle,
		onExport,
		onZoomIn,
		onZoomOut,
		onZoomReset
	}: Props = $props();

	const tabTitles: Record<MobileTab, (() => string) | null> = {
		draw: null,
		colors: m.tab_colors,
		settings: m.tab_settings
	};
</script>

{#if activeTab === 'draw'}
	<header class="app-bar">
		<div class="logo-area">
			<a href="/" class="logo-link" aria-label="Home">
				<img src="/apple-touch-icon.png" alt="" width="24" height="24" class="logo-icon" />
			</a>
		</div>

		<div class="actions">
			<!-- Zoom controls: medium only -->
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
			</div>

			<button class="action-btn" onclick={onExport} aria-label={m.action_exportPng()}>
				<Download size={18} />
			</button>
			<button
				class="action-btn"
				class:active={showGrid}
				onclick={onGridToggle}
				aria-label={m.action_toggleGrid()}
				aria-pressed={showGrid}
			>
				<Grid3X3 size={18} />
			</button>
		</div>
	</header>
{:else}
	<header class="app-bar heading-bar">
		<h1 class="tab-title">{tabTitles[activeTab]?.()}</h1>
	</header>
{/if}

<style>
	.app-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 44px;
		padding: 0 16px;
		background: var(--ds-bg-surface);
		border-bottom: 1px solid var(--ds-border-subtle);
		flex-shrink: 0;
	}

	@media (min-width: 600px) {
		.app-bar {
			height: 48px;
		}
	}

	.heading-bar {
		justify-content: flex-start;
	}

	.tab-title {
		margin: 0;
		font-family: var(--ds-font-body);
		font-size: 16px;
		font-weight: 600;
		color: var(--ds-text-primary);
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
		gap: 8px;
	}

	/* Zoom controls hidden on compact, shown on medium */
	.zoom-controls {
		display: none;
		align-items: center;
		background: var(--ds-bg-hover);
		border-radius: var(--ds-radius-sm);
		height: 36px;
		padding: 0 4px;
	}

	@media (min-width: 600px) {
		.zoom-controls {
			display: flex;
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
		font-size: 11px;
		color: var(--ds-text-primary);
		cursor: pointer;
		padding: 0 4px;
		white-space: nowrap;
	}

	.action-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border: none;
		background: none;
		border-radius: 8px;
		cursor: pointer;
		padding: 0;
		color: var(--ds-text-secondary);
	}

	.action-btn:first-of-type {
		color: var(--ds-accent);
	}

	.action-btn:hover {
		background: var(--ds-bg-hover);
	}

	.action-btn.active {
		color: var(--ds-accent);
	}
</style>
