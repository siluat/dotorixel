<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import ToolStrip from './ToolStrip.svelte';

	const { Story } = defineMeta({});

	const noop = () => {};
</script>

<Story name="Default">
	<div style="width: 390px;">
		<ToolStrip
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
	<div style="width: 768px;">
		<ToolStrip
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

<!-- Line is constrainable but the latch is off: no badge; re-tapping the line button arms it. -->
<Story name="ConstrainableToolLatchOff">
	<div style="width: 390px;">
		<ToolStrip
			activeTool="line"
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

<!-- The Constrain latch is on: the active tool button carries the corner dot badge. -->
<Story name="ConstrainLatchOn">
	<div style="width: 390px;">
		<ToolStrip
			activeTool="rectangle"
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

<!-- Latch is on but pencil cannot constrain: the dot stays hidden (latch is dormant). -->
<Story name="LatchOnNonConstrainableTool">
	<div style="width: 390px;">
		<ToolStrip
			activeTool="pencil"
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
