<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		variant?: 'default' | 'primary' | 'secondary';
		size?: 'sm' | 'md' | 'icon';
		shadow?: boolean;
		active?: boolean;
		disabled?: boolean;
		title?: string;
		onclick?: (event: MouseEvent) => void;
		children: Snippet;
	}

	let {
		variant = 'default',
		size = 'md',
		shadow = true,
		active = false,
		disabled = false,
		title,
		onclick,
		children
	}: Props = $props();
</script>

<button
	type="button"
	class="flat-button flat-button--{variant} flat-button--{size}"
	class:flat-button--shadow={shadow}
	class:flat-button--active={active}
	aria-pressed={active ? 'true' : undefined}
	{disabled}
	{title}
	{onclick}
>
	{@render children()}
</button>

<style>
	.flat-button {
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
		border-width: var(--border-width);
		transition: none;
	}

	/* ── Size variants ── */

	.flat-button--sm {
		height: 28px;
		padding: 0 var(--space-3);
		font-size: 10px;
	}

	.flat-button--md {
		height: 36px;
		padding: 0 var(--space-4);
	}

	.flat-button--icon {
		width: 36px;
		height: 36px;
		padding: 0;
	}

	/* ── Default variant ── */

	.flat-button--default {
		background: var(--color-surface);
		color: var(--color-surface-fg);
		border-color: var(--color-border);
	}

	.flat-button--default:hover:not(:disabled) {
		background: var(--color-muted);
	}

	/* ── Primary variant ── */

	.flat-button--primary {
		background: var(--color-primary);
		color: var(--color-primary-fg);
		border-color: color-mix(in oklch, var(--color-primary), black 20%);
	}

	.flat-button--primary:hover:not(:disabled) {
		background: color-mix(in oklch, var(--color-primary), black 10%);
	}

	/* ── Secondary variant ── */

	.flat-button--secondary {
		background: var(--color-secondary);
		color: var(--color-secondary-fg);
		border-color: var(--color-border);
	}

	.flat-button--secondary:hover:not(:disabled) {
		background: color-mix(in oklch, var(--color-secondary), var(--color-bg) 20%);
	}

	/* ── Shadow ── */

	.flat-button--shadow {
		box-shadow: var(--border-width) var(--border-width) 0 var(--color-border-shadow);
	}

	/* ── Active state (after variant rules so it takes precedence) ── */

	.flat-button--active {
		background: var(--color-accent);
		color: var(--color-accent-fg);
	}

	.flat-button--active:hover:not(:disabled) {
		background: var(--color-accent);
	}

	/* ── Press effect ── */

	.flat-button:active:not(:disabled) {
		translate: var(--border-width) var(--border-width);
	}

	.flat-button--shadow:active:not(:disabled) {
		box-shadow: none;
	}

	/* ── Disabled state ── */

	.flat-button:disabled {
		opacity: 0.5;
		pointer-events: none;
	}
</style>
