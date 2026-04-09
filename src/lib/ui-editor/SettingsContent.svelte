<script lang="ts">
	import { Download, Trash2 } from 'lucide-svelte';
	import * as m from '$lib/paraglide/messages';
	import type { ResizeAnchor } from '$lib/canvas/canvas-model';
	import CanvasSizeControl from './CanvasSizeControl.svelte';

	interface Props {
		canvasWidth: number;
		canvasHeight: number;
		showGrid: boolean;
		resizeAnchor: ResizeAnchor;
		onResize: (width: number, height: number) => void;
		onExport: () => void;
		onClear: () => void;
		onGridToggle: () => void;
		onAnchorChange: (anchor: ResizeAnchor) => void;
	}

	let {
		canvasWidth,
		canvasHeight,
		showGrid,
		resizeAnchor,
		onResize,
		onExport,
		onClear,
		onGridToggle,
		onAnchorChange
	}: Props = $props();
</script>

<div class="settings-content">
	<!-- Canvas Size Section -->
	<section class="section">
		<h3 class="section-title">{m.canvas_size()}</h3>
		<CanvasSizeControl
			{canvasWidth}
			{canvasHeight}
			{resizeAnchor}
			{onResize}
			{onAnchorChange}
			variant="touch"
		/>
	</section>

	<!-- Actions Section -->
	<section class="section">
		<h3 class="section-title">{m.section_actions()}</h3>
		<button class="action-btn primary" onclick={onExport}>
			<Download size={18} />
			<span>{m.label_export()}</span>
		</button>
		<button class="action-btn outline" onclick={onClear}>
			<Trash2 size={18} />
			<span>{m.action_clearCanvas()}</span>
		</button>
	</section>

	<!-- Display Section -->
	<section class="section">
		<h3 class="section-title">{m.section_display()}</h3>
		<div class="toggle-row">
			<span class="toggle-label">{m.label_showGrid()}</span>
			<button
				class="toggle-switch"
				class:active={showGrid}
				onclick={onGridToggle}
				role="switch"
				aria-checked={showGrid}
				aria-label={m.label_showGrid()}
			>
				<span class="toggle-thumb"></span>
			</button>
		</div>
	</section>
</div>

<style>
	.settings-content {
		display: flex;
		flex-direction: column;
		gap: 24px;
		padding: 16px;
		overflow-y: auto;
		height: 100%;
	}

	.section {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.section-title {
		margin: 0;
		font-family: var(--ds-font-body);
		font-size: 14px;
		font-weight: 600;
		color: var(--ds-text-primary);
	}

	/* Actions */
	.action-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		width: 100%;
		height: 44px;
		border-radius: 8px;
		font-family: var(--ds-font-body);
		font-size: 13px;
		cursor: pointer;
		padding: 0;
	}

	.action-btn.primary {
		background: var(--ds-accent);
		border: none;
		color: #ffffff;
	}

	.action-btn.primary:hover {
		background: color-mix(in srgb, var(--ds-accent) 85%, black);
	}

	.action-btn.outline {
		background: none;
		border: 1px solid var(--ds-border);
		color: var(--ds-text-secondary);
	}

	.action-btn.outline:hover {
		background: var(--ds-bg-hover);
	}

	/* Toggle */
	.toggle-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 44px;
	}

	.toggle-label {
		font-family: var(--ds-font-body);
		font-size: 13px;
		color: var(--ds-text-primary);
	}

	.toggle-switch {
		position: relative;
		width: 44px;
		height: 26px;
		border: none;
		border-radius: 13px;
		background: var(--ds-bg-active);
		cursor: pointer;
		padding: 2px;
		transition: background 0.15s;
	}

	.toggle-switch.active {
		background: var(--ds-accent);
	}

	.toggle-thumb {
		display: block;
		width: 22px;
		height: 22px;
		border-radius: 50%;
		background: #ffffff;
		box-shadow: var(--ds-shadow-sm);
		transition: transform 0.15s;
	}

	.toggle-switch.active .toggle-thumb {
		transform: translateX(18px);
	}
</style>
