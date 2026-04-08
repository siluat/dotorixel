<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import TopBar from './TopBar.svelte';

	const { Story } = defineMeta({});
</script>

<Story name="Default">
	<TopBar
		zoomPercent={800}
		showGrid={true}
		isExportOpen={false}
		canvasWidth={16}
		canvasHeight={16}
		onZoomIn={() => {}}
		onZoomOut={() => {}}
		onZoomReset={() => {}}
		onFit={() => {}}
		onGridToggle={() => {}}
		onExportToggle={() => {}}
		onExportConfirm={() => {}}
	/>
</Story>

<Story name="GridOff">
	<TopBar
		zoomPercent={100}
		showGrid={false}
		isExportOpen={false}
		canvasWidth={32}
		canvasHeight={32}
		onZoomIn={() => {}}
		onZoomOut={() => {}}
		onZoomReset={() => {}}
		onFit={() => {}}
		onGridToggle={() => {}}
		onExportToggle={() => {}}
		onExportConfirm={() => {}}
	/>
</Story>
