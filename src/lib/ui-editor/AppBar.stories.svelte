<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import AppBar from './AppBar.svelte';

	const { Story } = defineMeta({});
</script>

<Story name="DrawTab">
	<div style="width: 390px;">
		<AppBar
			activeTab="draw"
			showGrid={true}
			pixelPerfect={true}
			pixelPerfectDisabled={false}
			zoomPercent={800}
			onGridToggle={() => {}}
			onPixelPerfectToggle={() => {}}
			onExport={() => {}}
			onZoomIn={() => {}}
			onZoomOut={() => {}}
			onZoomReset={() => {}}
		/>
	</div>
</Story>

<Story name="ColorsTab">
	<div style="width: 390px;">
		<AppBar
			activeTab="colors"
			showGrid={false}
			pixelPerfect={true}
			pixelPerfectDisabled={false}
			zoomPercent={100}
			onGridToggle={() => {}}
			onPixelPerfectToggle={() => {}}
			onExport={() => {}}
			onZoomIn={() => {}}
			onZoomOut={() => {}}
			onZoomReset={() => {}}
		/>
	</div>
</Story>

<Story name="SettingsTab">
	<div style="width: 390px;">
		<AppBar
			activeTab="settings"
			showGrid={false}
			pixelPerfect={true}
			pixelPerfectDisabled={false}
			zoomPercent={100}
			onGridToggle={() => {}}
			onPixelPerfectToggle={() => {}}
			onExport={() => {}}
			onZoomIn={() => {}}
			onZoomOut={() => {}}
			onZoomReset={() => {}}
		/>
	</div>
</Story>
