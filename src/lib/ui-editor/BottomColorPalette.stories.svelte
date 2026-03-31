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
	<div class="editor-story-bg">
		<BottomColorPalette foregroundColor="#2D2D2D" backgroundColor="#ffffff" onForegroundColorChange={noop} />
	</div>
</Story>

<Story name="PinkSelected">
	<div class="editor-story-bg">
		<BottomColorPalette foregroundColor="#E8729A" backgroundColor="#ffffff" onForegroundColorChange={noop} />
	</div>
</Story>

<Story name="WhiteSelected">
	<div class="editor-story-bg">
		<BottomColorPalette foregroundColor="#FFFFFF" backgroundColor="#2D2D2D" onForegroundColorChange={noop} />
	</div>
</Story>

<Story name="Interactive">
	<div class="editor-story-bg">
		<BottomColorPalette
			foregroundColor={interactiveColor}
			backgroundColor={interactiveBg}
			onForegroundColorChange={(c) => (interactiveColor = c)}
			onSwapColors={handleSwapColors}
		/>
	</div>
</Story>

<style>
	.editor-story-bg {
		background: var(--ds-bg-base);
		padding: 40px;
	}
</style>
