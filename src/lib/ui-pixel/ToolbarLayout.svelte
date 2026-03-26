<script lang="ts">
	import type { Component } from 'svelte';
	import type { ToolbarButtonProps, ToolbarItem } from './toolbar-types';
	import PixelPanel from './PixelPanel.svelte';

	interface Props {
		Button: Component<ToolbarButtonProps>;
		items: ToolbarItem[];
	}

	let { Button, items }: Props = $props();

	const ICON_SIZE = 16;
</script>

<PixelPanel style="padding: 0">
	<div class="toolbar">
		{#each items as item}
			{#if item.kind === 'button'}
				{@const Icon = item.icon}
				<Button
					size="icon"
					active={item.active}
					disabled={item.disabled}
					title={item.label}
					shortcutHint={item.shortcutHint}
					onclick={item.onclick}
				>
					<Icon size={ICON_SIZE} />
				</Button>
			{:else if item.kind === 'separator'}
				<span class="separator"></span>
			{:else if item.kind === 'label'}
				<span class="toolbar-label">{item.text}</span>
			{/if}
		{/each}
	</div>
</PixelPanel>

<style>
	.toolbar {
		--press-compensation: var(--border-width);
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1);
		padding: var(--space-2) calc(var(--space-2) + var(--press-compensation))
			calc(var(--space-2) + var(--press-compensation)) var(--space-2);
	}

	.separator {
		width: var(--border-width);
		height: var(--space-6);
		background: var(--color-border);
		margin: 0 var(--space-2);
	}

	.toolbar-label {
		font-family: var(--font-mono);
		font-size: 12px;
		font-variant-numeric: tabular-nums;
		min-width: 40px;
		text-align: center;
	}
</style>
