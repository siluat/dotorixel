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
			zoomPercent={800}
			onGridToggle={() => {}}
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
			zoomPercent={100}
			onGridToggle={() => {}}
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
			zoomPercent={100}
			onGridToggle={() => {}}
			onExport={() => {}}
			onZoomIn={() => {}}
			onZoomOut={() => {}}
			onZoomReset={() => {}}
		/>
	</div>
</Story>
