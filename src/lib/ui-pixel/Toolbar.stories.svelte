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
	<div class="pixel-editor pixel-story-bg">
		<Toolbar {...defaults} />
	</div>
</Story>

<Story name="WithHistory">
	<div class="pixel-editor pixel-story-bg">
		<Toolbar {...defaults} canUndo={true} canRedo={true} />
	</div>
</Story>

<Story name="LineActive">
	<div class="pixel-editor pixel-story-bg">
		<Toolbar {...defaults} activeTool="line" />
	</div>
</Story>

<Story name="RectangleActive">
	<div class="pixel-editor pixel-story-bg">
		<Toolbar {...defaults} activeTool="rectangle" />
	</div>
</Story>

<Story name="EraserActive">
	<div class="pixel-editor pixel-story-bg">
		<Toolbar {...defaults} activeTool="eraser" canUndo={true} />
	</div>
</Story>

<Story name="MoveActive">
	<div class="pixel-editor pixel-story-bg">
		<Toolbar {...defaults} activeTool="move" />
	</div>
</Story>

<Story name="ZoomedIn">
	<div class="pixel-editor pixel-story-bg">
		<Toolbar {...defaults} zoomPercent={400} showGrid={false} />
	</div>
</Story>

<Story name="WithFlatButton">
	<div class="pixel-editor pixel-story-bg">
		<Toolbar {...defaults} Button={FlatButton} />
	</div>
</Story>

<script lang="ts">
	let activeTool = $state<ToolType>('pencil');
	let showGrid = $state(true);
	let canUndo = $state(false);
	let canRedo = $state(false);
	let zoomPercent = $state(100);
</script>

<Story name="Interactive">
	<div class="pixel-editor pixel-story-bg">
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
	</div>
</Story>

<style>
	.pixel-story-bg {
		background: oklch(0.96 0.02 75);
		padding: 16px;
	}
</style>
