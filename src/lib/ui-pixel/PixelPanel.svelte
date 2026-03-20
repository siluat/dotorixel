<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		variant?: 'default' | 'inset' | 'raised';
		style?: string;
		children: Snippet;
	}

	let { variant = 'default', style, children }: Props = $props();
</script>

<div class="pixel-panel pixel-panel--{variant}" {style}>
	{@render children()}
</div>

<style>
	.pixel-panel {
		background: var(--color-surface);
		padding: var(--space-4);
	}

	.pixel-panel--default {
		border: var(--border-width) solid var(--color-border);
	}

	.pixel-panel--inset {
		border: var(--border-width) solid var(--color-border);
		border-top-color: var(--color-border-shadow);
		border-left-color: var(--color-border-shadow);
		border-bottom-color: var(--color-border-highlight);
		border-right-color: var(--color-border-highlight);
		border-top-width: var(--border-width-thick);
		border-left-width: var(--border-width-thick);
	}

	.pixel-panel--raised {
		border: var(--border-width) solid var(--color-border);
		border-top-color: var(--color-border-highlight);
		border-left-color: var(--color-border-highlight);
		border-bottom-color: var(--color-border-shadow);
		border-right-color: var(--color-border-shadow);
		border-bottom-width: var(--border-width-thick);
		border-right-width: var(--border-width-thick);
	}
</style>
