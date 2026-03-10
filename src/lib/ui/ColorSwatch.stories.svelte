<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import ColorSwatch from './ColorSwatch.svelte';

	const { Story } = defineMeta({});
</script>

<script lang="ts">
	const paletteColors = [
		'#2b2b2b', '#5b3a29', '#8b4513', '#cd853f',
		'#f4a460', '#ffdead', '#ffffff', '#c0c0c0',
		'#808080', '#404040', '#ff0000', '#ff4500',
		'#ff8c00', '#ffd700', '#ffff00', '#adff2f',
		'#00ff00', '#00fa9a', '#00ced1', '#1e90ff',
		'#0000ff', '#8a2be2', '#ff00ff', '#ff69b4',
		'#ff1493', '#dc143c', '#b22222', '#800000',
		'#006400', '#008080', '#000080', '#4b0082',
		'#2f4f4f', '#696969', '#a9a9a9', '#d3d3d3'
	];
</script>

<Story name="Default">
	<ColorSwatch color="#ff4500" />
</Story>

<Story name="Selected">
	<div class="swatch-row">
		<ColorSwatch color="#1e90ff" />
		<ColorSwatch color="#1e90ff" selected />
	</div>
</Story>

<Story name="Sizes">
	<div class="swatch-row">
		<div class="size-item">
			<span class="size-label">sm</span>
			<ColorSwatch color="#00ff00" size="sm" />
		</div>
		<div class="size-item">
			<span class="size-label">md</span>
			<ColorSwatch color="#00ff00" size="md" />
		</div>
	</div>
</Story>

<Story name="PaletteGrid">
	<div class="palette-grid">
		{#each paletteColors as color, i}
			<ColorSwatch {color} selected={i === 10} />
		{/each}
	</div>
</Story>

<style>
	.swatch-row {
		display: flex;
		align-items: center;
		gap: var(--space-4);
	}

	.size-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-2);
	}

	.size-label {
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--color-muted-fg);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.palette-grid {
		display: grid;
		grid-template-columns: repeat(9, 28px);
		gap: var(--space-1);
	}
</style>
