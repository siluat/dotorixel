<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import StatusBar from './StatusBar.svelte';

	const { Story } = defineMeta({});
</script>

<Story name="Default">
	<StatusBar canvasWidth={32} canvasHeight={32} activeTool="pencil" />
</Story>

<Story name="LargeCanvas">
	<StatusBar canvasWidth={128} canvasHeight={64} activeTool="floodfill" />
</Story>
