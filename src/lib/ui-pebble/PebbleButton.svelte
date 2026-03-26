<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		active?: boolean;
		disabled?: boolean;
		title?: string;
		shortcutHint?: string;
		onclick?: (event: MouseEvent) => void;
		children: Snippet;
	}

	let { active = false, disabled = false, title, shortcutHint, onclick, children }: Props = $props();
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
	<span class="shortcut-badge" class:shortcut-badge--visible={shortcutHint} aria-hidden="true">
		{shortcutHint ?? ''}
	</span>
</button>

<style>
	.pebble-btn {
		position: relative;
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

	.shortcut-badge {
		--badge-bg: oklch(0.3 0.04 45 / 0.9);
		position: absolute;
		top: -6px;
		right: -6px;
		min-width: 18px;
		height: 18px;
		padding: 0 4px;
		border-radius: 9px;
		background: var(--badge-bg);
		color: #ffffff;
		font-size: 10px;
		font-weight: 600;
		line-height: 18px;
		text-align: center;
		white-space: nowrap;
		pointer-events: none;
		opacity: 0;
		transition: opacity 0.15s;
	}

	.shortcut-badge--visible {
		opacity: 1;
	}
</style>
