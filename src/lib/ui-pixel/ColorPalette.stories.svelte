<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import ColorPalette from './ColorPalette.svelte';

	const { Story } = defineMeta({});
</script>

<Story name="Default">
	<div class="pixel-editor pixel-story-bg">
		<ColorPalette selectedColor="#000000" onColorChange={() => {}} />
	</div>
</Story>

<Story name="WithRecentColors">
	<div class="pixel-editor pixel-story-bg">
		<ColorPalette
			selectedColor="#1e90ff"
			recentColors={['#ff0000', '#00ff00', '#0000ff', '#ffd700', '#ff69b4']}
			onColorChange={() => {}}
		/>
	</div>
</Story>

<Story name="CustomColorSelected">
	<div class="pixel-editor pixel-story-bg">
		<ColorPalette selectedColor="#7b3f00" onColorChange={() => {}} />
	</div>
</Story>

<script lang="ts">
	import { addRecentColor } from '$lib/canvas/color';

	let interactiveColor = $state('#ff0000');
	let interactiveRecent: string[] = $state([]);

	function handleInteractiveChange(color: string): void {
		interactiveRecent = addRecentColor(interactiveRecent, interactiveColor);
		interactiveColor = color;
	}
</script>

<Story name="Interactive">
	<div class="pixel-editor pixel-story-bg">
		<ColorPalette
			selectedColor={interactiveColor}
			recentColors={interactiveRecent}
			onColorChange={handleInteractiveChange}
		/>
	</div>
</Story>

<style>
	.pixel-story-bg {
		background: oklch(0.96 0.02 75);
		padding: 16px;
	}
</style>
