<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import BottomColorPalette from './BottomColorPalette.svelte';

	const { Story } = defineMeta({});
</script>

<script lang="ts">
	const noop = (_hex: string) => {};
	let interactiveColor = $state('#2D2D2D');
	let interactiveBg = $state('#ffffff');

	function handleSwapColors(): void {
		const temp = interactiveColor;
		interactiveColor = interactiveBg;
		interactiveBg = temp;
	}
</script>

<Story name="Default">
	<div class="pebble-editor pebble-story-bg">
		<BottomColorPalette selectedColor="#2D2D2D" backgroundColor="#ffffff" onColorChange={noop} />
	</div>
</Story>

<Story name="PinkSelected">
	<div class="pebble-editor pebble-story-bg">
		<BottomColorPalette selectedColor="#E8729A" backgroundColor="#ffffff" onColorChange={noop} />
	</div>
</Story>

<Story name="WhiteSelected">
	<div class="pebble-editor pebble-story-bg">
		<BottomColorPalette selectedColor="#FFFFFF" backgroundColor="#2D2D2D" onColorChange={noop} />
	</div>
</Story>

<Story name="Interactive">
	<div class="pebble-editor pebble-story-bg">
		<BottomColorPalette
			selectedColor={interactiveColor}
			backgroundColor={interactiveBg}
			onColorChange={(c) => (interactiveColor = c)}
			onSwapColors={handleSwapColors}
		/>
	</div>
</Story>

<style>
	.pebble-story-bg {
		background: #EFECE8;
		padding: 40px;
	}
</style>
