<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import BottomToolsPanel from './BottomToolsPanel.svelte';

	const { Story } = defineMeta({});

	const noop = () => {};
	const noopTool = (/** @type {string} */ _t) => {};
</script>

<Story name="PenSelected">
	<div class="editor-story-bg">
		<BottomToolsPanel activeTool="pencil" zoomPercent={800} onToolChange={noopTool} onZoomIn={noop} onZoomOut={noop} onZoomReset={noop} />
	</div>
</Story>

<Story name="LineSelected">
	<div class="editor-story-bg">
		<BottomToolsPanel activeTool="line" zoomPercent={800} onToolChange={noopTool} onZoomIn={noop} onZoomOut={noop} onZoomReset={noop} />
	</div>
</Story>

<Story name="RectangleSelected">
	<div class="editor-story-bg">
		<BottomToolsPanel activeTool="rectangle" zoomPercent={800} onToolChange={noopTool} onZoomIn={noop} onZoomOut={noop} onZoomReset={noop} />
	</div>
</Story>

<Story name="EraserSelected">
	<div class="editor-story-bg">
		<BottomToolsPanel activeTool="eraser" zoomPercent={400} onToolChange={noopTool} onZoomIn={noop} onZoomOut={noop} onZoomReset={noop} />
	</div>
</Story>

<Story name="ZoomLevels">
	<div class="editor-story-bg">
		<div class="zoom-stack">
			<BottomToolsPanel activeTool="pencil" zoomPercent={100} onToolChange={noopTool} onZoomIn={noop} onZoomOut={noop} onZoomReset={noop} />
			<BottomToolsPanel activeTool="pencil" zoomPercent={1600} onToolChange={noopTool} onZoomIn={noop} onZoomOut={noop} onZoomReset={noop} />
			<BottomToolsPanel activeTool="pencil" zoomPercent={3200} onToolChange={noopTool} onZoomIn={noop} onZoomOut={noop} onZoomReset={noop} />
		</div>
	</div>
</Story>

<style>
	.editor-story-bg {
		background: var(--ds-bg-base);
		padding: 40px;
	}

	.zoom-stack {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
</style>
