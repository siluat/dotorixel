<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		class?: string;
		style?: string;
		children: Snippet;
	}

	let { class: className = '', style, children }: Props = $props();
</script>

<div class="floating-panel {className}" {style}>
	{@render children()}
</div>

<style>
	.floating-panel {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 16px;
		background: var(--pebble-panel-bg);
		border: 1px solid var(--pebble-panel-border);
		border-radius: var(--pebble-panel-radius);
		box-shadow: var(--pebble-panel-shadow);
	}
</style>
