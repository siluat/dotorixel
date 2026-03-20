<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import Toolbar from './Toolbar.svelte';
	import BevelButton from './BevelButton.svelte';
	import FlatButton from './FlatButton.svelte';
	import type { ToolType } from './toolbar-types';

	const { Story } = defineMeta({});

	const noop = () => {};

	const defaults = {
		Button: BevelButton,
		activeTool: 'pencil' as ToolType,
		canUndo: false,
		canRedo: false,
		zoomPercent: 100,
		showGrid: true,
		onToolChange: noop,
		onUndo: noop,
		onRedo: noop,
		onZoomIn: noop,
		onZoomOut: noop,
		onFit: noop,
		onGridToggle: noop,
		onClear: noop,
		onExport: noop
	};
</script>

<Story name="Default">
	<Toolbar {...defaults} />
</Story>

<Story name="WithHistory">
	<Toolbar {...defaults} canUndo={true} canRedo={true} />
</Story>

<Story name="EraserActive">
	<Toolbar {...defaults} activeTool="eraser" canUndo={true} />
</Story>

<Story name="ZoomedIn">
	<Toolbar {...defaults} zoomPercent={400} showGrid={false} />
</Story>

<Story name="WithFlatButton">
	<Toolbar {...defaults} Button={FlatButton} />
</Story>

<script lang="ts">
	let activeTool = $state<ToolType>('pencil');
	let showGrid = $state(true);
	let canUndo = $state(false);
	let canRedo = $state(false);
	let zoomPercent = $state(100);
</script>

<Story name="Interactive">
	<Toolbar
		{...defaults}
		{activeTool}
		{canUndo}
		{canRedo}
		{zoomPercent}
		{showGrid}
		onToolChange={(tool) => (activeTool = tool)}
		onZoomIn={() => (zoomPercent = Math.min(zoomPercent * 2, 1600))}
		onZoomOut={() => (zoomPercent = Math.max(zoomPercent / 2, 25))}
		onFit={() => (zoomPercent = 100)}
		onGridToggle={() => (showGrid = !showGrid)}
		onClear={() => {
			canUndo = true;
			canRedo = false;
		}}
	/>
</Story>
