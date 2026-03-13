<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import CanvasSettings from './CanvasSettings.svelte';

	const { Story } = defineMeta({});
</script>

<Story name="Default">
	<CanvasSettings canvasWidth={16} canvasHeight={16} onResize={() => {}} />
</Story>

<Story name="SmallCanvas">
	<CanvasSettings canvasWidth={8} canvasHeight={8} onResize={() => {}} />
</Story>

<Story name="LargeCanvas">
	<CanvasSettings canvasWidth={64} canvasHeight={64} onResize={() => {}} />
</Story>

<Story name="CustomSize">
	<CanvasSettings canvasWidth={24} canvasHeight={16} onResize={() => {}} />
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
	<CanvasSettings
		canvasWidth={interactiveWidth}
		canvasHeight={interactiveHeight}
		onResize={handleResize}
	/>
</Story>
