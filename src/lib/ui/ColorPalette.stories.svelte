<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import ColorPalette from './ColorPalette.svelte';

	const { Story } = defineMeta({});
</script>

<Story name="Default">
	<ColorPalette selectedColor="#000000" onColorChange={() => {}} />
</Story>

<Story name="WithRecentColors">
	<ColorPalette
		selectedColor="#1e90ff"
		recentColors={['#ff0000', '#00ff00', '#0000ff', '#ffd700', '#ff69b4']}
		onColorChange={() => {}}
	/>
</Story>

<Story name="CustomColorSelected">
	<ColorPalette selectedColor="#7b3f00" onColorChange={() => {}} />
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
	<ColorPalette
		selectedColor={interactiveColor}
		recentColors={interactiveRecent}
		onColorChange={handleInteractiveChange}
	/>
</Story>
