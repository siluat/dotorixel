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
		gap: var(--ds-space-3);
		padding: 10px 16px;
		background: color-mix(in srgb, var(--ds-bg-elevated) 93%, transparent);
		border: 1px solid var(--ds-border);
		border-radius: var(--ds-radius-lg);
		box-shadow: var(--ds-shadow-md);
		backdrop-filter: blur(16px);
		-webkit-backdrop-filter: blur(16px);
	}
</style>
