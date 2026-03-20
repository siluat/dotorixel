<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import PebbleSwatch from './PebbleSwatch.svelte';

	const { Story } = defineMeta({});
</script>

<Story name="Default">
	<div class="pebble-editor pebble-story-bg">
		<PebbleSwatch color="#E8729A" />
	</div>
</Story>

<Story name="Selected">
	<div class="pebble-editor pebble-story-bg">
		<PebbleSwatch color="#E8729A" selected />
	</div>
</Story>

<Story name="Sizes">
	<div class="pebble-editor pebble-story-bg">
		<div class="swatch-row">
			<PebbleSwatch color="#F4A7B9" size="sm" />
			<PebbleSwatch color="#F4A7B9" size="lg" />
		</div>
	</div>
</Story>

<Story name="WhiteBorder">
	<div class="pebble-editor pebble-story-bg">
		<div class="swatch-row">
			<PebbleSwatch color="#FFFFFF" />
			<PebbleSwatch color="#FFFFFF" selected />
		</div>
	</div>
</Story>

<Story name="PalettePreview">
	<div class="pebble-editor pebble-story-bg">
		<div class="swatch-grid">
			<PebbleSwatch color="#2D2D2D" />
			<PebbleSwatch color="#FFFFFF" />
			<PebbleSwatch color="#E8729A" selected />
			<PebbleSwatch color="#F4A7B9" />
			<PebbleSwatch color="#FDDDE6" />
			<PebbleSwatch color="#FFC0CB" />
			<PebbleSwatch color="#FF8A65" />
			<PebbleSwatch color="#FFD54F" />
			<PebbleSwatch color="#FFEE58" />
		</div>
	</div>
</Story>

<style>
	.pebble-story-bg {
		background: #EFECE8;
		padding: 40px;
	}

	.swatch-row {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.swatch-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
</style>
