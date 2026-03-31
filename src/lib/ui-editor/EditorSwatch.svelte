<script lang="ts">
	interface Props {
		color: string;
		selected?: boolean;
		size?: 'sm' | 'lg';
		onclick?: (event: MouseEvent) => void;
	}

	let { color, selected = false, size = 'sm', onclick }: Props = $props();

	const isWhite = $derived(color.toUpperCase() === '#FFFFFF' || color.toUpperCase() === '#FFF');
</script>

<button
	type="button"
	class="editor-swatch editor-swatch--{size}"
	class:editor-swatch--selected={selected}
	class:editor-swatch--white={isWhite}
	style:--swatch-color={color}
	title={color}
	aria-label={color}
	aria-pressed={selected ? 'true' : undefined}
	{onclick}
></button>

<style>
	.editor-swatch {
		padding: 0;
		border: none;
		border-radius: var(--ds-radius-sm);
		background-color: var(--swatch-color);
		cursor: pointer;
		transition: transform 0.12s ease;
	}

	.editor-swatch--sm {
		width: 24px;
		height: 24px;
	}

	.editor-swatch--lg {
		width: 32px;
		height: 32px;
	}

	.editor-swatch:hover {
		transform: scale(1.1);
	}

	.editor-swatch--selected {
		outline: 2px solid var(--ds-accent);
		outline-offset: 2px;
	}

	.editor-swatch--white {
		border: 1px solid var(--ds-border);
	}
</style>
