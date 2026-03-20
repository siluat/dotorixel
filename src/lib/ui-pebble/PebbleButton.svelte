<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		active?: boolean;
		disabled?: boolean;
		title?: string;
		onclick?: (event: MouseEvent) => void;
		children: Snippet;
	}

	let { active = false, disabled = false, title, onclick, children }: Props = $props();
</script>

<button
	type="button"
	class="pebble-btn"
	class:pebble-btn--active={active}
	aria-pressed={active ? 'true' : undefined}
	{disabled}
	{title}
	{onclick}
>
	{@render children()}
</button>

<style>
	.pebble-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		padding: 0;
		border: 1px solid transparent;
		border-radius: var(--pebble-btn-radius);
		background: var(--pebble-btn-bg);
		color: var(--pebble-text-secondary);
		box-shadow: var(--pebble-btn-shadow);
		cursor: pointer;
		transition: background 0.15s, color 0.15s, box-shadow 0.15s;
	}

	.pebble-btn:hover:not(:disabled) {
		background: #EDEAE5;
		color: var(--pebble-text-primary);
	}

	.pebble-btn--active {
		background: var(--pebble-accent);
		color: #FFFFFF;
		box-shadow: 0 2px 8px oklch(0.55 0.15 45 / 0.3);
	}

	.pebble-btn--active:hover:not(:disabled) {
		background: var(--pebble-accent-dark);
		color: #FFFFFF;
	}

	.pebble-btn:disabled {
		opacity: 0.4;
		pointer-events: none;
	}
</style>
