<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import TopBar from './TopBar.svelte';

	const { Story } = defineMeta({});
</script>

<Story name="Default">
	<TopBar
		zoomPercent={800}
		showGrid={true}
		onZoomIn={() => {}}
		onZoomOut={() => {}}
		onZoomReset={() => {}}
		onFit={() => {}}
		onGridToggle={() => {}}
		onExport={() => {}}
	/>
</Story>

<Story name="GridOff">
	<TopBar
		zoomPercent={100}
		showGrid={false}
		onZoomIn={() => {}}
		onZoomOut={() => {}}
		onZoomReset={() => {}}
		onFit={() => {}}
		onGridToggle={() => {}}
		onExport={() => {}}
	/>
</Story>
