<script lang="ts">
	import type { MarqueeRegion } from '$lib/canvas/canvas-model';
	import * as m from '$lib/paraglide/messages';
	import { TOOL_ENTRIES, type ToolType } from '$lib/ui-editor/tool-ui';
	import type { LayoutMode } from './layout-mode.svelte';

	interface Props {
		canvasWidth: number;
		canvasHeight: number;
		activeTool: ToolType;
		layoutMode?: LayoutMode;
		marquee?: MarqueeRegion;
		includeBottomSafeArea?: boolean;
	}

	let {
		canvasWidth,
		canvasHeight,
		activeTool,
		layoutMode = 'wide',
		marquee,
		includeBottomSafeArea = true
	}: Props = $props();

	const activeLabel = $derived(TOOL_ENTRIES.find((t) => t.type === activeTool)?.label() ?? '');
	const marqueeReadout = $derived.by(() => {
		if (!marquee) return null;
		if (layoutMode === 'compact') {
			return m.status_marqueeCompact({ width: marquee.width, height: marquee.height });
		}
		return m.status_marquee({
			width: marquee.width,
			height: marquee.height,
			x: marquee.x,
			y: marquee.y
		});
	});
</script>

<footer class="status-bar" class:with-bottom-safe-area={includeBottomSafeArea}>
	<span class="status-size">{canvasWidth} &times; {canvasHeight}</span>
	{#if marqueeReadout}
		<span class="status-marquee">{marqueeReadout}</span>
	{/if}
	<div class="status-spacer"></div>
	<span class="status-tool">{activeLabel}</span>
</footer>

<style>
	.status-bar {
		display: flex;
		align-items: center;
		gap: var(--ds-space-5);
		min-height: 28px;
		padding: 0 var(--ds-space-4);
		background: var(--ds-bg-surface);
		border-top: 1px solid var(--ds-border-subtle);
	}

	.status-bar.with-bottom-safe-area {
		padding-bottom: env(safe-area-inset-bottom, 0px);
	}

	.status-size {
		font-family: var(--ds-font-body);
		font-size: var(--ds-font-size-sm);
		color: var(--ds-text-secondary);
		white-space: nowrap;
	}

	.status-marquee {
		font-family: var(--ds-font-body);
		font-size: var(--ds-font-size-sm);
		color: var(--ds-text-secondary);
		white-space: nowrap;
	}

	.status-spacer {
		flex: 1;
	}

	.status-tool {
		font-family: var(--ds-font-body);
		font-size: var(--ds-font-size-sm);
		color: var(--ds-text-tertiary);
		white-space: nowrap;
	}
</style>
