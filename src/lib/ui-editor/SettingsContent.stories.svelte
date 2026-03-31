<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import SettingsContent from './SettingsContent.svelte';

	const { Story } = defineMeta({});
</script>

<Story name="Default">
	<div style="width: 390px; height: 700px; background: var(--ds-bg-base);">
		<SettingsContent
			canvasWidth={32}
			canvasHeight={32}
			showGrid={true}
			onResize={() => {}}
			onExport={() => {}}
			onClear={() => {}}
			onGridToggle={() => {}}
		/>
	</div>
</Story>

<Story name="LargeCanvas">
	<div style="width: 390px; height: 700px; background: var(--ds-bg-base);">
		<SettingsContent
			canvasWidth={128}
			canvasHeight={64}
			showGrid={false}
			onResize={() => {}}
			onExport={() => {}}
			onClear={() => {}}
			onGridToggle={() => {}}
		/>
	</div>
</Story>
