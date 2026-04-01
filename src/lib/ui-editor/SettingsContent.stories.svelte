<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import SettingsContent from './SettingsContent.svelte';

	const { Story } = defineMeta({});

	const noop = () => {};
</script>

<Story name="Default">
	<div style="width: 390px; height: 700px; background: var(--ds-bg-base);">
		<SettingsContent
			canvasWidth={32}
			canvasHeight={32}
			showGrid={true}
			resizeAnchor="top-left"
			onResize={noop}
			onExport={noop}
			onClear={noop}
			onGridToggle={noop}
			onAnchorChange={noop}
		/>
	</div>
</Story>

<Story name="LargeCanvas">
	<div style="width: 390px; height: 700px; background: var(--ds-bg-base);">
		<SettingsContent
			canvasWidth={128}
			canvasHeight={64}
			showGrid={false}
			resizeAnchor="center"
			onResize={noop}
			onExport={noop}
			onClear={noop}
			onGridToggle={noop}
			onAnchorChange={noop}
		/>
	</div>
</Story>
