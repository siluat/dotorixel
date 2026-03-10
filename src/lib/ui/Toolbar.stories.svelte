<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import Toolbar from './Toolbar.svelte';

	const { Story } = defineMeta({});

	const noop = () => {};
</script>

<Story name="Default">
	<Toolbar
		activeTool="pencil"
		canUndo={false}
		canRedo={false}
		zoomPercent={100}
		showGrid={true}
		onToolChange={noop}
		onUndo={noop}
		onRedo={noop}
		onZoomIn={noop}
		onZoomOut={noop}
		onFit={noop}
		onGridToggle={noop}
		onClear={noop}
		onExport={noop}
	/>
</Story>

<Story name="WithHistory">
	<Toolbar
		activeTool="pencil"
		canUndo={true}
		canRedo={true}
		zoomPercent={100}
		showGrid={true}
		onToolChange={noop}
		onUndo={noop}
		onRedo={noop}
		onZoomIn={noop}
		onZoomOut={noop}
		onFit={noop}
		onGridToggle={noop}
		onClear={noop}
		onExport={noop}
	/>
</Story>

<Story name="EraserActive">
	<Toolbar
		activeTool="eraser"
		canUndo={true}
		canRedo={false}
		zoomPercent={100}
		showGrid={true}
		onToolChange={noop}
		onUndo={noop}
		onRedo={noop}
		onZoomIn={noop}
		onZoomOut={noop}
		onFit={noop}
		onGridToggle={noop}
		onClear={noop}
		onExport={noop}
	/>
</Story>

<Story name="ZoomedIn">
	<Toolbar
		activeTool="pencil"
		canUndo={false}
		canRedo={false}
		zoomPercent={400}
		showGrid={false}
		onToolChange={noop}
		onUndo={noop}
		onRedo={noop}
		onZoomIn={noop}
		onZoomOut={noop}
		onFit={noop}
		onGridToggle={noop}
		onClear={noop}
		onExport={noop}
	/>
</Story>

<script lang="ts">
	import type { ToolType } from '$lib/canvas/tool';

	let activeTool: ToolType = $state('pencil');
	let showGrid = $state(true);
	let canUndo = $state(false);
	let canRedo = $state(false);
	let zoomPercent = $state(100);
</script>

<Story name="Interactive">
	<Toolbar
		{activeTool}
		{canUndo}
		{canRedo}
		{zoomPercent}
		{showGrid}
		onToolChange={(tool) => (activeTool = tool)}
		onUndo={() => {}}
		onRedo={() => {}}
		onZoomIn={() => (zoomPercent = Math.min(zoomPercent * 2, 1600))}
		onZoomOut={() => (zoomPercent = Math.max(zoomPercent / 2, 25))}
		onFit={() => (zoomPercent = 100)}
		onGridToggle={() => (showGrid = !showGrid)}
		onClear={() => {
			canUndo = true;
			canRedo = false;
		}}
		onExport={() => {}}
	/>
</Story>
