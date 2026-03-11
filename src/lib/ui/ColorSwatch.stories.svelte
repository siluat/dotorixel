<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import ColorSwatch from './ColorSwatch.svelte';

	const { Story } = defineMeta({});
</script>

<script lang="ts">
	import { DEFAULT_PALETTE } from './color-palette-data';
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
		{#each DEFAULT_PALETTE as color, i}
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
