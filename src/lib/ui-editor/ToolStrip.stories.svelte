<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import ToolStrip from './ToolStrip.svelte';

	// The strip's layout is viewport-keyed (@media min-width: 600px), so a wrapper
	// div can't trigger the compact branch — each story pins a viewport global
	// instead. layout:fullscreen renders the strip edge-to-edge like the real
	// bottom bar; '390-844' is the compact tier, '768-1024' the medium tier.
	const { Story } = defineMeta({
		parameters: { layout: 'fullscreen' }
	});

	const noop = () => {};
</script>

<!-- ToolStrip lives only in the compact (touch) layout, so the default view is the
     390px strip where 9 tools + Undo can't fit at 44px: the tools scroll horizontally
     (last button clipped as the scroll affordance) while Undo stays pinned at the edge. -->
<Story name="Default" globals={{ viewport: { value: '390-844' } }}>
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
</Story>

<Story name="EraserActive" globals={{ viewport: { value: '768-1024' } }}>
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
</Story>

<!-- Line is constrainable but the latch is off: no badge; re-tapping the line button arms it. -->
<Story name="ConstrainableToolLatchOff" globals={{ viewport: { value: '390-844' } }}>
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
</Story>

<!-- The Constrain latch is on: the active tool button carries the corner dot badge. -->
<Story name="ConstrainLatchOn" globals={{ viewport: { value: '390-844' } }}>
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
</Story>

<!-- Latch is on but pencil cannot constrain: the dot stays hidden (latch is dormant). -->
<Story name="LatchOnNonConstrainableTool" globals={{ viewport: { value: '390-844' } }}>
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
</Story>
