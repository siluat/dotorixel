<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import CanvasSizeControl from './CanvasSizeControl.svelte';

	const { Story } = defineMeta({});

	const noop = () => {};
</script>

<Story name="Compact">
	<div style="width: 200px; background: var(--ds-bg-surface); padding: 12px;">
		<CanvasSizeControl
			canvasWidth={32}
			canvasHeight={32}
			resizeAnchor="top-left"
			onResize={noop}
			onAnchorChange={noop}
		/>
	</div>
</Story>

<Story name="Touch">
	<div style="width: 390px; background: var(--ds-bg-base); padding: 16px;">
		<CanvasSizeControl
			canvasWidth={32}
			canvasHeight={32}
			resizeAnchor="top-left"
			variant="touch"
			onResize={noop}
			onAnchorChange={noop}
		/>
	</div>
</Story>

<Story name="CompactActivePreset">
	<div style="width: 200px; background: var(--ds-bg-surface); padding: 12px;">
		<CanvasSizeControl
			canvasWidth={16}
			canvasHeight={16}
			resizeAnchor="center"
			onResize={noop}
			onAnchorChange={noop}
		/>
	</div>
</Story>
