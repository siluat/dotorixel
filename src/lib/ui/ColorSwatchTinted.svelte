<script lang="ts">
	interface Props {
		color: string;
		selected?: boolean;
		size?: 'sm' | 'md';
		onclick?: (event: MouseEvent) => void;
	}

	let { color, selected = false, size = 'md', onclick }: Props = $props();
</script>

<button
	type="button"
	class="color-swatch color-swatch--{size}"
	class:color-swatch--selected={selected}
	style:--swatch-color={color}
	title={color}
	aria-pressed={selected ? 'true' : undefined}
	{onclick}
></button>

<style>
	.color-swatch {
		/* Subtle 3D depth scaled for small color swatches */
		--depth: calc((var(--border-width) + var(--border-width-thick)) / 2);
		--border-tint: color-mix(in oklch, var(--swatch-color) 55%, black);

		padding: 0;
		cursor: pointer;
		background-color: var(--swatch-color);
		border: var(--border-width) solid var(--border-tint);
		border-bottom-width: var(--depth);
		border-right-width: var(--depth);
	}

	/* ── Size variants ── */

	.color-swatch--sm {
		width: 20px;
		height: 20px;
	}

	.color-swatch--md {
		width: 28px;
		height: 28px;
	}

	/* ── Hover ── */

	.color-swatch:hover {
		border-color: color-mix(in oklch, var(--swatch-color) 40%, black);
	}

	/* ── Selected ── */

	.color-swatch--selected {
		outline: 2px solid var(--color-primary);
		outline-offset: 1px;
	}

	/* ── Press effect ── */

	.color-swatch:active {
		border-bottom-width: var(--border-width);
		border-right-width: var(--border-width);
	}
</style>
