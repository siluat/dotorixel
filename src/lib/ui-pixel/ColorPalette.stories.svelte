<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import ColorPalette from './ColorPalette.svelte';

	const { Story } = defineMeta({});
</script>

<Story name="Default">
	<div class="pixel-editor pixel-story-bg">
		<ColorPalette selectedColor="#000000" backgroundColor="#ffffff" onColorChange={() => {}} />
	</div>
</Story>

<Story name="WithRecentColors">
	<div class="pixel-editor pixel-story-bg">
		<ColorPalette
			selectedColor="#1e90ff"
			backgroundColor="#ffffff"
			recentColors={['#ff0000', '#00ff00', '#0000ff', '#ffd700', '#ff69b4']}
			onColorChange={() => {}}
		/>
	</div>
</Story>

<Story name="CustomColorSelected">
	<div class="pixel-editor pixel-story-bg">
		<ColorPalette selectedColor="#7b3f00" backgroundColor="#ffffff" onColorChange={() => {}} />
	</div>
</Story>

<script lang="ts">
	import { addRecentColor } from '$lib/canvas/color';

	let interactiveColor = $state('#ff0000');
	let interactiveBg = $state('#ffffff');
	let interactiveRecent: string[] = $state([]);

	function handleInteractiveChange(color: string): void {
		interactiveRecent = addRecentColor(interactiveRecent, interactiveColor);
		interactiveColor = color;
	}

	function handleSwapColors(): void {
		const temp = interactiveColor;
		interactiveColor = interactiveBg;
		interactiveBg = temp;
	}
</script>

<Story name="Interactive">
	<div class="pixel-editor pixel-story-bg">
		<ColorPalette
			selectedColor={interactiveColor}
			backgroundColor={interactiveBg}
			recentColors={interactiveRecent}
			onColorChange={handleInteractiveChange}
			onSwapColors={handleSwapColors}
		/>
	</div>
</Story>

<style>
	.pixel-story-bg {
		background: oklch(0.96 0.02 75);
		padding: 16px;
	}
</style>
