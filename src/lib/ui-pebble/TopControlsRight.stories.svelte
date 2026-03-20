<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import TopControlsRight from './TopControlsRight.svelte';

	const { Story } = defineMeta({});

	const noop = () => {};
	const noopResize = (/** @type {number} */ _w, /** @type {number} */ _h) => {};
</script>

<Story name="Default">
	<div class="pebble-editor pebble-story-bg">
		<TopControlsRight canvasWidth={16} canvasHeight={16} onResize={noopResize} onExport={noop} onClear={noop} />
	</div>
</Story>

<Story name="LargeCanvas">
	<div class="pebble-editor pebble-story-bg">
		<TopControlsRight canvasWidth={64} canvasHeight={64} onResize={noopResize} onExport={noop} onClear={noop} />
	</div>
</Story>

<Story name="RectangularCanvas">
	<div class="pebble-editor pebble-story-bg">
		<TopControlsRight canvasWidth={32} canvasHeight={16} onResize={noopResize} onExport={noop} onClear={noop} />
	</div>
</Story>

<style>
	.pebble-story-bg {
		background: #EFECE8;
		padding: 40px;
		position: relative;
		min-height: 120px;
	}
</style>
