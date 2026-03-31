<script lang="ts">
	import { onMount } from 'svelte';
	import { EditorState } from '$lib/canvas/editor-state.svelte';
	import PixelCanvasView from '$lib/canvas/PixelCanvasView.svelte';
	import TopControlsLeft from '$lib/ui-editor/TopControlsLeft.svelte';
	import TopControlsRight from '$lib/ui-editor/TopControlsRight.svelte';
	import BottomToolsPanel from '$lib/ui-editor/BottomToolsPanel.svelte';
	import BottomColorPalette from '$lib/ui-editor/BottomColorPalette.svelte';
	import {
		trackEditorOpen,
		trackToolUsage,
		trackExport,
		trackCanvasSize,
		trackSessionEnd
	} from '$lib/analytics/events';

	const editor = new EditorState({
		foregroundColor: { r: 45, g: 45, b: 45, a: 255 },
		gridColor: '#ECE5D9'
	});

	let canvasContainerEl: HTMLDivElement | undefined = $state();
	let needsInitialFit = true;

	onMount(() => {
		trackEditorOpen('editor');
		const sessionStart = Date.now();
		return () => {
			trackSessionEnd((Date.now() - sessionStart) / 1000);
		};
	});

	let prevTool: string | undefined;
	$effect(() => {
		const tool = editor.activeTool;
		if (prevTool !== undefined && prevTool !== tool) {
			trackToolUsage(tool);
		}
		prevTool = tool;
	});

	$effect(() => {
		if (!canvasContainerEl) return;
		const ro = new ResizeObserver((entries) => {
			const entry = entries[0];
			if (!entry) return;
			const { width, height } = entry.contentRect;
			const w = Math.round(width);
			const h = Math.round(height);
			editor.viewportSize = { width: w, height: h };
			if (needsInitialFit) {
				needsInitialFit = false;
				const defaultViewportSize = 512;
				const dx = (w - defaultViewportSize) / 2;
				const dy = (h - defaultViewportSize) / 2;
				editor.viewportState = {
					...editor.viewportState,
					viewport: editor.viewportState.viewport.pan(dx, dy)
				};
			}
		});
		ro.observe(canvasContainerEl);
		return () => ro.disconnect();
	});
</script>

<svelte:window onkeydown={editor.handleKeyDown} onkeyup={editor.handleKeyUp} onblur={editor.handleBlur} />

<div class="editor">
	<TopControlsLeft
		canUndo={editor.canUndo}
		canRedo={editor.canRedo}
		showGrid={editor.viewportState.showGrid}
		showShortcutHints={editor.shortcutHintsVisible}
		onUndo={editor.handleUndo}
		onRedo={editor.handleRedo}
		onGridToggle={editor.handleGridToggle}
	/>

	<TopControlsRight
		canvasWidth={editor.pixelCanvas.width}
		canvasHeight={editor.pixelCanvas.height}
		onResize={(w, h) => {
			editor.handleResize(w, h);
			trackCanvasSize(w, h);
		}}
		onExport={() => {
			editor.handleExportPng();
			trackExport(editor.pixelCanvas.width, editor.pixelCanvas.height);
		}}
		onClear={editor.handleClear}
	/>

	<div class="editor-canvas-area" bind:this={canvasContainerEl}>
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
	</div>

	<div class="editor-bottom">
		<BottomToolsPanel
			activeTool={editor.activeTool}
			zoomPercent={editor.zoomPercent}
			showShortcutHints={editor.shortcutHintsVisible}
			onToolChange={(tool) => (editor.activeTool = tool)}
			onZoomIn={editor.handleZoomIn}
			onZoomOut={editor.handleZoomOut}
			onZoomReset={editor.handleZoomReset}
		/>
		<BottomColorPalette
			foregroundColor={editor.foregroundColorHex}
			backgroundColor={editor.backgroundColorHex}
			onForegroundColorChange={editor.handleForegroundColorChange}
			onBackgroundColorChange={editor.handleBackgroundColorChange}
			onSwapColors={editor.swapColors}
		/>
	</div>
</div>

<style>
	.editor {
		position: relative;
		width: 100%;
		height: 100vh;
		background: var(--ds-bg-base);
		font-family: var(--ds-font-body);
		overflow: hidden;
	}

	.editor-canvas-area {
		position: absolute;
		inset: 0;
	}

	.editor-bottom {
		position: absolute;
		bottom: var(--ds-space-5);
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 10px;
		z-index: 10;
	}
</style>
