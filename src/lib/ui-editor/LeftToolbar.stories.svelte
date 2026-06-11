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
			constrainLatchOn={false}
			onToolChange={() => {}}
			onUndo={() => {}}
			onRedo={() => {}}
			onConstrainLatchToggle={() => {}}
		/>
	</div>
</Story>

<Story name="EraserActive">
	<div style="height: 600px;">
		<LeftToolbar
			activeTool="eraser"
			canUndo={true}
			canRedo={true}
			constrainLatchOn={false}
			onToolChange={() => {}}
			onUndo={() => {}}
			onRedo={() => {}}
			onConstrainLatchToggle={() => {}}
		/>
	</div>
</Story>

<Story name="MoveActive">
	<div style="height: 600px;">
		<LeftToolbar
			activeTool="move"
			canUndo={false}
			canRedo={false}
			constrainLatchOn={false}
			onToolChange={() => {}}
			onUndo={() => {}}
			onRedo={() => {}}
			onConstrainLatchToggle={() => {}}
		/>
	</div>
</Story>

<Story name="ConstrainActive">
	<div style="height: 600px;">
		<LeftToolbar
			activeTool="line"
			canUndo={true}
			canRedo={true}
			constrainLatchOn={true}
			onToolChange={() => {}}
			onUndo={() => {}}
			onRedo={() => {}}
			onConstrainLatchToggle={() => {}}
		/>
	</div>
</Story>
