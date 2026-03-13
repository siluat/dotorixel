<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import StatusBar from './StatusBar.svelte';

	const { Story } = defineMeta({});
</script>

<Story name="Default">
	<StatusBar canvasWidth={16} canvasHeight={16} zoomPercent={100} activeTool="pencil" />
</Story>

<Story name="SmallCanvas">
	<StatusBar canvasWidth={8} canvasHeight={8} zoomPercent={100} activeTool="pencil" />
</Story>

<Story name="LargeCanvasZoomed">
	<StatusBar canvasWidth={64} canvasHeight={64} zoomPercent={400} activeTool="eraser" />
</Story>

<Story name="CustomSize">
	<StatusBar canvasWidth={24} canvasHeight={16} zoomPercent={50} activeTool="pencil" />
</Story>
