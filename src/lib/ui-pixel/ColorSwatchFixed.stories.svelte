<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import ColorSwatchFixed from './ColorSwatchFixed.svelte';

	const { Story } = defineMeta({});
</script>

<script lang="ts">
	import { DEFAULT_PALETTE } from './color-palette-data';
</script>

<Story name="Default">
	<div class="pixel-editor pixel-story-bg">
		<ColorSwatchFixed color="#ff4500" />
	</div>
</Story>

<Story name="Selected">
	<div class="pixel-editor pixel-story-bg">
		<div class="swatch-row">
			<ColorSwatchFixed color="#1e90ff" />
			<ColorSwatchFixed color="#1e90ff" selected />
		</div>
	</div>
</Story>

<Story name="Sizes">
	<div class="pixel-editor pixel-story-bg">
		<div class="swatch-row">
			<div class="size-item">
				<span class="size-label">sm</span>
				<ColorSwatchFixed color="#00ff00" size="sm" />
			</div>
			<div class="size-item">
				<span class="size-label">md</span>
				<ColorSwatchFixed color="#00ff00" size="md" />
			</div>
		</div>
	</div>
</Story>

<Story name="PaletteGrid">
	<div class="pixel-editor pixel-story-bg">
		<div class="palette-grid">
			{#each DEFAULT_PALETTE as color, i}
				<ColorSwatchFixed {color} selected={i === 10} />
			{/each}
		</div>
	</div>
</Story>

<style>
	.pixel-story-bg {
		background: oklch(0.96 0.02 75);
		padding: 16px;
	}

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
