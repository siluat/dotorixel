<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import BottomColorPalette from './BottomColorPalette.svelte';

	const { Story } = defineMeta({});

	const noop = (/** @type {string} */ _hex) => {};
</script>

<Story name="Default">
	<div class="pebble-editor pebble-story-bg">
		<BottomColorPalette selectedColor="#2D2D2D" onColorChange={noop} />
	</div>
</Story>

<Story name="PinkSelected">
	<div class="pebble-editor pebble-story-bg">
		<BottomColorPalette selectedColor="#E8729A" onColorChange={noop} />
	</div>
</Story>

<Story name="WhiteSelected">
	<div class="pebble-editor pebble-story-bg">
		<BottomColorPalette selectedColor="#FFFFFF" onColorChange={noop} />
	</div>
</Story>

<style>
	.pebble-story-bg {
		background: #EFECE8;
		padding: 40px;
	}
</style>
