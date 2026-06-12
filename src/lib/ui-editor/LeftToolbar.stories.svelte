<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import LeftToolbar from './LeftToolbar.svelte';

	const { Story } = defineMeta({});

	const noop = () => {};
</script>

<Story name="Default">
	<div style="height: 600px;">
		<LeftToolbar
			activeTool="pencil"
			canUndo={true}
			canRedo={false}
			constrainActive={false}
			onToolChange={noop}
			onUndo={noop}
			onRedo={noop}
			onToggleConstrain={noop}
		/>
	</div>
</Story>

<Story name="EraserActive">
	<div style="height: 600px;">
		<LeftToolbar
			activeTool="eraser"
			canUndo={true}
			canRedo={true}
			constrainActive={false}
			onToolChange={noop}
			onUndo={noop}
			onRedo={noop}
			onToggleConstrain={noop}
		/>
	</div>
</Story>

<Story name="MoveActive">
	<div style="height: 600px;">
		<LeftToolbar
			activeTool="move"
			canUndo={false}
			canRedo={false}
			constrainActive={false}
			onToolChange={noop}
			onUndo={noop}
			onRedo={noop}
			onToggleConstrain={noop}
		/>
	</div>
</Story>

<!-- The Constrain latch is on: the active tool button carries the corner dot. -->
<Story name="ConstrainLatchOn">
	<div style="height: 600px;">
		<LeftToolbar
			activeTool="line"
			canUndo={true}
			canRedo={false}
			constrainActive={true}
			onToolChange={noop}
			onUndo={noop}
			onRedo={noop}
			onToggleConstrain={noop}
		/>
	</div>
</Story>
