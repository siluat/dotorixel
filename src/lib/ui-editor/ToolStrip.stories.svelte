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
			onToolChange={() => {}}
			onUndo={() => {}}
			onRedo={() => {}}
		/>
	</div>
</Story>

<Story name="EraserActive">
	<div style="width: 768px;">
		<ToolStrip
			activeTool="eraser"
			canUndo={true}
			canRedo={true}
			onToolChange={() => {}}
			onUndo={() => {}}
			onRedo={() => {}}
		/>
	</div>
</Story>
