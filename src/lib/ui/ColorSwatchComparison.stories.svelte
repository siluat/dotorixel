<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import ColorSwatchFixed from './ColorSwatchFixed.svelte';

	const { Story } = defineMeta({});
</script>

<script lang="ts">
	import ColorSwatchTinted from './ColorSwatchTinted.svelte';
	import { DEFAULT_PALETTE } from './color-palette-data';
</script>

<Story name="SideBySide">
	<div class="comparison">
		<div class="comparison-column">
			<h3 class="comparison-title">Current (fixed border)</h3>
			<div class="palette-grid">
				{#each DEFAULT_PALETTE as color, i}
					<ColorSwatchFixed {color} selected={i === 10} />
				{/each}
			</div>
		</div>
		<div class="comparison-column">
			<h3 class="comparison-title">Tinted (color-relative border)</h3>
			<div class="palette-grid">
				{#each DEFAULT_PALETTE as color, i}
					<ColorSwatchTinted {color} selected={i === 10} />
				{/each}
			</div>
		</div>
	</div>
</Story>

<Story name="SmallSize">
	<div class="comparison">
		<div class="comparison-column">
			<h3 class="comparison-title">Current (fixed border)</h3>
			<div class="palette-grid palette-grid--sm">
				{#each DEFAULT_PALETTE as color, i}
					<ColorSwatchFixed {color} size="sm" selected={i === 10} />
				{/each}
			</div>
		</div>
		<div class="comparison-column">
			<h3 class="comparison-title">Tinted (color-relative border)</h3>
			<div class="palette-grid palette-grid--sm">
				{#each DEFAULT_PALETTE as color, i}
					<ColorSwatchTinted {color} size="sm" selected={i === 10} />
				{/each}
			</div>
		</div>
	</div>
</Story>

<Story name="DarkColors">
	{@const darkColors = ['#2b2b2b', '#404040', '#000000', '#1a1a1a', '#0d0d0d', '#333333', '#800000', '#000080', '#006400', '#4b0082']}
	<div class="comparison">
		<div class="comparison-column">
			<h3 class="comparison-title">Current (fixed border)</h3>
			<div class="palette-grid">
				{#each darkColors as color}
					<ColorSwatchFixed {color} />
				{/each}
			</div>
		</div>
		<div class="comparison-column">
			<h3 class="comparison-title">Tinted (color-relative border)</h3>
			<div class="palette-grid">
				{#each darkColors as color}
					<ColorSwatchTinted {color} />
				{/each}
			</div>
		</div>
	</div>
</Story>

<Story name="BrightColors">
	{@const brightColors = ['#ff0000', '#ff4500', '#ffd700', '#ffff00', '#00ff00', '#00ced1', '#1e90ff', '#0000ff', '#ff00ff', '#ff69b4']}
	<div class="comparison">
		<div class="comparison-column">
			<h3 class="comparison-title">Current (fixed border)</h3>
			<div class="palette-grid">
				{#each brightColors as color}
					<ColorSwatchFixed {color} />
				{/each}
			</div>
		</div>
		<div class="comparison-column">
			<h3 class="comparison-title">Tinted (color-relative border)</h3>
			<div class="palette-grid">
				{#each brightColors as color}
					<ColorSwatchTinted {color} />
				{/each}
			</div>
		</div>
	</div>
</Story>

<style>
	.comparison {
		display: flex;
		gap: var(--space-7);
	}

	.comparison-column {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.comparison-title {
		font-family: var(--font-body);
		font-size: 14px;
		font-weight: 400;
		color: var(--color-muted-fg);
		margin: 0;
	}

	.palette-grid {
		display: grid;
		grid-template-columns: repeat(5, 28px);
		gap: var(--space-1);
	}

	.palette-grid--sm {
		grid-template-columns: repeat(5, 20px);
	}
</style>
