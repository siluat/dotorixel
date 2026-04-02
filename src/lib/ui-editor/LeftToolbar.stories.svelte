<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import LeftToolbar from './LeftToolbar.svelte';

	const { Story } = defineMeta({});
</script>

<Story name="Default">
	<div style="height: 600px;">
		<LeftToolbar
			activeTool="pencil"
			canUndo={true}
			canRedo={false}
			onToolChange={() => {}}
			onUndo={() => {}}
			onRedo={() => {}}
		/>
	</div>
</Story>

<Story name="EraserActive">
	<div style="height: 600px;">
		<LeftToolbar
			activeTool="eraser"
			canUndo={true}
			canRedo={true}
			onToolChange={() => {}}
			onUndo={() => {}}
			onRedo={() => {}}
		/>
	</div>
</Story>

<Story name="MoveActive">
	<div style="height: 600px;">
		<LeftToolbar
			activeTool="move"
			canUndo={false}
			canRedo={false}
			onToolChange={() => {}}
			onUndo={() => {}}
			onRedo={() => {}}
		/>
	</div>
</Story>
