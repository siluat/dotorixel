<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import TopControlsLeft from './TopControlsLeft.svelte';

	const { Story } = defineMeta({});

	const noop = () => {};
</script>

<Story name="Default">
	<div class="pebble-editor pebble-story-bg">
		<TopControlsLeft canUndo={true} canRedo={true} showGrid={false} onUndo={noop} onRedo={noop} onGridToggle={noop} />
	</div>
</Story>

<Story name="UndoRedoDisabled">
	<div class="pebble-editor pebble-story-bg">
		<TopControlsLeft canUndo={false} canRedo={false} showGrid={false} onUndo={noop} onRedo={noop} onGridToggle={noop} />
	</div>
</Story>

<Story name="GridActive">
	<div class="pebble-editor pebble-story-bg">
		<TopControlsLeft canUndo={true} canRedo={false} showGrid={true} onUndo={noop} onRedo={noop} onGridToggle={noop} />
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
