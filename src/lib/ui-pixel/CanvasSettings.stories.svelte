<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import CanvasSettings from './CanvasSettings.svelte';

	const { Story } = defineMeta({});
</script>

<Story name="Default">
	<div class="pixel-editor pixel-story-bg">
		<CanvasSettings canvasWidth={16} canvasHeight={16} onResize={() => {}} />
	</div>
</Story>

<Story name="SmallCanvas">
	<div class="pixel-editor pixel-story-bg">
		<CanvasSettings canvasWidth={8} canvasHeight={8} onResize={() => {}} />
	</div>
</Story>

<Story name="LargeCanvas">
	<div class="pixel-editor pixel-story-bg">
		<CanvasSettings canvasWidth={64} canvasHeight={64} onResize={() => {}} />
	</div>
</Story>

<Story name="CustomSize">
	<div class="pixel-editor pixel-story-bg">
		<CanvasSettings canvasWidth={24} canvasHeight={16} onResize={() => {}} />
	</div>
</Story>

<script lang="ts">
	let interactiveWidth = $state(16);
	let interactiveHeight = $state(16);

	function handleResize(width: number, height: number): void {
		interactiveWidth = width;
		interactiveHeight = height;
	}
</script>

<Story name="Interactive">
	<div class="pixel-editor pixel-story-bg">
		<CanvasSettings
			canvasWidth={interactiveWidth}
			canvasHeight={interactiveHeight}
			onResize={handleResize}
		/>
	</div>
</Story>

<style>
	.pixel-story-bg {
		background: oklch(0.96 0.02 75);
		padding: 16px;
	}
</style>
