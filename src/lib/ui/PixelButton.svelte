<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		variant?: 'default' | 'primary' | 'secondary';
		size?: 'sm' | 'md' | 'icon';
		active?: boolean;
		disabled?: boolean;
		title?: string;
		onclick?: (event: MouseEvent) => void;
		children: Snippet;
	}

	let {
		variant = 'default',
		size = 'md',
		active = false,
		disabled = false,
		title,
		onclick,
		children
	}: Props = $props();
</script>

<button
	type="button"
	class="pixel-button pixel-button--{variant} pixel-button--{size}"
	class:pixel-button--active={active}
	aria-pressed={active ? 'true' : undefined}
	{disabled}
	{title}
	{onclick}
>
	{@render children()}
</button>

<style>
	.pixel-button {
		--press-offset: calc(var(--border-width-thick) - var(--border-width));
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		font-family: var(--font-mono);
		font-size: 12px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		cursor: pointer;
		border-style: solid;
		transition: none;
	}

	/* ── Size variants ── */

	.pixel-button--sm {
		height: 28px;
		padding: 0 var(--space-3);
		font-size: 10px;
	}

	.pixel-button--md {
		height: 36px;
		padding: 0 var(--space-4);
	}

	.pixel-button--icon {
		width: 36px;
		height: 36px;
		padding: 0;
	}

	/* ── Default variant ── */

	.pixel-button--default {
		background: var(--color-surface);
		color: var(--color-surface-fg);
		border-color: var(--color-border);
		border-width: var(--border-width);
		border-top-color: var(--color-border-highlight);
		border-left-color: var(--color-border-highlight);
		border-bottom-color: var(--color-border-shadow);
		border-right-color: var(--color-border-shadow);
		border-bottom-width: var(--border-width-thick);
		border-right-width: var(--border-width-thick);
	}

	.pixel-button--default:hover:not(:disabled) {
		background: var(--color-muted);
	}

	/* ── Primary variant ── */

	.pixel-button--primary {
		background: var(--color-primary);
		color: var(--color-primary-fg);
		border-width: var(--border-width);
		border-top-color: color-mix(in oklch, var(--color-primary), white 20%);
		border-left-color: color-mix(in oklch, var(--color-primary), white 20%);
		border-bottom-color: color-mix(in oklch, var(--color-primary), black 40%);
		border-right-color: color-mix(in oklch, var(--color-primary), black 40%);
		border-bottom-width: var(--border-width-thick);
		border-right-width: var(--border-width-thick);
	}

	.pixel-button--primary:hover:not(:disabled) {
		background: color-mix(in oklch, var(--color-primary), black 10%);
	}

	/* ── Secondary variant ── */

	.pixel-button--secondary {
		background: var(--color-secondary);
		color: var(--color-secondary-fg);
		border-width: var(--border-width);
		border-top-color: var(--color-border-highlight);
		border-left-color: var(--color-border-highlight);
		border-bottom-color: var(--color-border-shadow);
		border-right-color: var(--color-border-shadow);
		border-bottom-width: var(--border-width-thick);
		border-right-width: var(--border-width-thick);
	}

	.pixel-button--secondary:hover:not(:disabled) {
		background: color-mix(in oklch, var(--color-secondary), var(--color-bg) 20%);
	}

	/* ── Active state (after variant rules so it takes precedence) ── */

	.pixel-button--active {
		background: var(--color-accent);
		color: var(--color-accent-fg);
	}

	.pixel-button--active:hover:not(:disabled) {
		background: var(--color-accent);
	}

	/* ── Press effect ── */

	.pixel-button:active:not(:disabled) {
		border-bottom-width: var(--border-width);
		border-right-width: var(--border-width);
		translate: var(--press-offset) var(--press-offset);
	}

	/* ── Disabled state ── */

	.pixel-button:disabled {
		opacity: 0.5;
		pointer-events: none;
	}
</style>
