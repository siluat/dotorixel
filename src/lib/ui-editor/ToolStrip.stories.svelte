<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import ToolStrip from './ToolStrip.svelte';

	const { Story } = defineMeta({});
</script>

<Story name="Default">
	<div style="width: 390px;">
		<ToolStrip
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
	<div style="width: 768px;">
		<ToolStrip
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

<Story name="ConstrainActive">
	<div style="width: 390px;">
		<ToolStrip
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
