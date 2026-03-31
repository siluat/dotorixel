<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		active?: boolean;
		disabled?: boolean;
		title?: string;
		ariaLabel?: string;
		shortcutHint?: string;
		onclick?: (event: MouseEvent) => void;
		children: Snippet;
	}

	let { active = false, disabled = false, title, ariaLabel, shortcutHint, onclick, children }: Props = $props();
</script>

<button
	type="button"
	class="editor-btn"
	class:editor-btn--active={active}
	aria-pressed={active ? 'true' : undefined}
	aria-label={ariaLabel ?? title}
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
	.editor-btn {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		padding: 0;
		border: 1px solid transparent;
		border-radius: var(--ds-radius-sm);
		background: var(--ds-bg-elevated);
		color: var(--ds-text-secondary);
		box-shadow: var(--ds-shadow-sm);
		cursor: pointer;
		transition: background 0.15s, color 0.15s, box-shadow 0.15s;
	}

	.editor-btn:hover:not(:disabled) {
		background: var(--ds-bg-hover);
		color: var(--ds-text-primary);
	}

	.editor-btn--active {
		background: var(--ds-accent);
		color: #FFFFFF;
		box-shadow: 0 2px 8px color-mix(in oklch, var(--ds-accent) 30%, transparent);
	}

	.editor-btn--active:hover:not(:disabled) {
		background: color-mix(in oklch, var(--ds-accent) 85%, black);
		color: #FFFFFF;
	}

	.editor-btn:disabled {
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
