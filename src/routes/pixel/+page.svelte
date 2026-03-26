<script lang="ts">
	import { EditorState } from '$lib/canvas/editor-state.svelte';
	import PixelCanvasView from '$lib/canvas/PixelCanvasView.svelte';
	import Toolbar from '$lib/ui-pixel/Toolbar.svelte';
	import BevelButton from '$lib/ui-pixel/BevelButton.svelte';
	import ColorPalette from '$lib/ui-pixel/ColorPalette.svelte';
	import CanvasSettings from '$lib/ui-pixel/CanvasSettings.svelte';
	import StatusBar from '$lib/ui-pixel/StatusBar.svelte';
	import PixelPanel from '$lib/ui-pixel/PixelPanel.svelte';
	import '$lib/ui-pixel/pixel-tokens.css';

	const editor = new EditorState();
</script>

<svelte:window onkeydown={editor.handleKeyDown} onkeyup={editor.handleKeyUp} onblur={editor.handleBlur} />

<div class="pixel-editor">
	<header class="pixel-header">
		<h1>DOTORIXEL</h1>
	</header>
	<main class="editor-area">
		<div class="editor-workspace">
			<div class="cell-toolbar">
				<Toolbar
					Button={BevelButton}
					activeTool={editor.activeTool}
					canUndo={editor.canUndo}
					canRedo={editor.canRedo}
					zoomPercent={editor.zoomPercent}
					showGrid={editor.viewportState.showGrid}
					onToolChange={(tool) => (editor.activeTool = tool)}
					onUndo={editor.handleUndo}
					onRedo={editor.handleRedo}
					onZoomIn={editor.handleZoomIn}
					onZoomOut={editor.handleZoomOut}
					onFit={editor.handleFit}
					onGridToggle={editor.handleGridToggle}
					onClear={editor.handleClear}
					onExport={editor.handleExportPng}
				/>
			</div>
			<div class="cell-palette">
				<ColorPalette
					foregroundColor={editor.foregroundColorHex}
					backgroundColor={editor.backgroundColorHex}
					recentColors={editor.recentColors}
					onForegroundColorChange={editor.handleForegroundColorChange}
					onBackgroundColorChange={editor.handleBackgroundColorChange}
					onSwapColors={editor.swapColors}
				/>
			</div>
			<div class="cell-canvas">
				<PixelPanel style="padding: 0;">
					<PixelCanvasView
						pixelCanvas={editor.pixelCanvas}
						viewportState={editor.viewportState}
						viewportSize={editor.viewportSize}
						renderVersion={editor.renderVersion}
						renderViewport={editor.renderViewport}
						onDraw={editor.handleDraw}
						onDrawStart={editor.handleDrawStart}
						onDrawEnd={editor.handleDrawEnd}
						onViewportChange={editor.handleViewportChange}
						isSpaceHeld={editor.isSpaceHeld}
					/>
				</PixelPanel>
			</div>
			<div class="cell-settings">
				<CanvasSettings
					canvasWidth={editor.pixelCanvas.width}
					canvasHeight={editor.pixelCanvas.height}
					onResize={editor.handleResize}
				/>
			</div>
			<div class="cell-status">
				<StatusBar
					canvasWidth={editor.pixelCanvas.width}
					canvasHeight={editor.pixelCanvas.height}
					zoomPercent={editor.zoomPercent}
					activeTool={editor.activeTool}
				/>
			</div>
		</div>
	</main>
</div>

<style>
	.pixel-editor {
		display: flex;
		flex-direction: column;
		height: 100vh;
	}

	.pixel-header {
		padding: var(--space-2) var(--space-4);
		border-bottom: var(--border-width) solid var(--color-border);
		background: var(--color-surface);
	}

	.pixel-header h1 {
		margin: 0;
		font-size: var(--font-size-lg);
	}

	.editor-area {
		flex: 1;
		display: flex;
		align-items: flex-start;
		justify-content: flex-start;
		background: var(--color-muted);
		overflow: auto;
		padding: var(--space-4);
	}

	.editor-workspace {
		display: grid;
		grid-template-columns: auto auto auto;
		grid-template-rows: auto auto auto;
		gap: var(--space-3);
		margin: auto;
	}

	.cell-toolbar {
		grid-column: 2;
		grid-row: 1;
		justify-self: center;
	}

	.cell-palette {
		grid-column: 1;
		grid-row: 2;
		align-self: start;
	}

	.cell-canvas {
		grid-column: 2;
		grid-row: 2;
		justify-self: center;
	}

	.cell-settings {
		grid-column: 3;
		grid-row: 2;
		align-self: start;
	}

	.cell-status {
		grid-column: 2;
		grid-row: 3;
		justify-self: center;
	}
</style>
