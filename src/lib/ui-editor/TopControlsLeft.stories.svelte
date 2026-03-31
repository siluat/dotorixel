<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import TopControlsLeft from './TopControlsLeft.svelte';

	const { Story } = defineMeta({});

	const noop = () => {};
</script>

<Story name="Default">
	<div class="editor-story-bg">
		<TopControlsLeft canUndo={true} canRedo={true} showGrid={false} onUndo={noop} onRedo={noop} onGridToggle={noop} />
	</div>
</Story>

<Story name="UndoRedoDisabled">
	<div class="editor-story-bg">
		<TopControlsLeft canUndo={false} canRedo={false} showGrid={false} onUndo={noop} onRedo={noop} onGridToggle={noop} />
	</div>
</Story>

<Story name="GridActive">
	<div class="editor-story-bg">
		<TopControlsLeft canUndo={true} canRedo={false} showGrid={true} onUndo={noop} onRedo={noop} onGridToggle={noop} />
	</div>
</Story>

<style>
	.editor-story-bg {
		background: var(--ds-bg-base);
		padding: 40px;
		position: relative;
		min-height: 120px;
	}
</style>
