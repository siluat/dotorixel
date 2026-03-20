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
	class="pebble-swatch pebble-swatch--{size}"
	class:pebble-swatch--selected={selected}
	class:pebble-swatch--white={isWhite}
	style:--swatch-color={color}
	title={color}
	aria-label={color}
	aria-pressed={selected ? 'true' : undefined}
	{onclick}
></button>

<style>
	.pebble-swatch {
		padding: 0;
		border: none;
		border-radius: 6px;
		background-color: var(--swatch-color);
		cursor: pointer;
		transition: transform 0.12s ease;
	}

	.pebble-swatch--sm {
		width: 22px;
		height: 22px;
	}

	.pebble-swatch--lg {
		width: 32px;
		height: 32px;
		border-radius: 8px;
	}

	.pebble-swatch:hover {
		transform: scale(1.1);
	}

	.pebble-swatch--selected {
		outline: 2.5px solid var(--pebble-accent-dark);
		outline-offset: 2px;
	}

	.pebble-swatch--white {
		border: 1px solid var(--pebble-panel-border);
	}
</style>
