<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import StatusBar from './StatusBar.svelte';

	const { Story } = defineMeta({});
</script>

<Story name="Default">
	<div class="pixel-editor pixel-story-bg">
		<StatusBar canvasWidth={16} canvasHeight={16} zoomPercent={100} activeTool="pencil" />
	</div>
</Story>

<Story name="SmallCanvas">
	<div class="pixel-editor pixel-story-bg">
		<StatusBar canvasWidth={8} canvasHeight={8} zoomPercent={100} activeTool="pencil" />
	</div>
</Story>

<Story name="LargeCanvasZoomed">
	<div class="pixel-editor pixel-story-bg">
		<StatusBar canvasWidth={64} canvasHeight={64} zoomPercent={400} activeTool="eraser" />
	</div>
</Story>

<Story name="CustomSize">
	<div class="pixel-editor pixel-story-bg">
		<StatusBar canvasWidth={24} canvasHeight={16} zoomPercent={50} activeTool="pencil" />
	</div>
</Story>

<style>
	.pixel-story-bg {
		background: oklch(0.96 0.02 75);
		padding: 16px;
	}
</style>
