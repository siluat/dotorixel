<script lang="ts">
	import { createCanvas, clearCanvas, resizeCanvas, type CanvasCoords } from '$lib/canvas/canvas';
	import {
		createDefaultViewport,
		zoomAtPoint,
		fitToViewport,
		nextZoomLevel,
		prevZoomLevel,
		type ViewportConfig
	} from '$lib/canvas/viewport';
	import { applyTool, interpolatePixels, type ToolType } from '$lib/canvas/tool';
	import { colorToHex, hexToColor, addRecentColor, type Color } from '$lib/canvas/color';
	import { createHistoryManager } from '$lib/canvas/history';
	import { exportAsPng } from '$lib/canvas/export';
	import PixelCanvasView from '$lib/canvas/PixelCanvasView.svelte';
	import Toolbar from '$lib/ui/Toolbar.svelte';
	import ColorPalette from '$lib/ui/ColorPalette.svelte';
	import CanvasSettings from '$lib/ui/CanvasSettings.svelte';
	import StatusBar from '$lib/ui/StatusBar.svelte';

	let pixelCanvas = $state.raw(createCanvas(16, 16));
	const viewportSize = { width: 512, height: 512 };

	let viewport: ViewportConfig = $state(createDefaultViewport(16, 16));
	let activeTool: ToolType = $state('pencil');
	let renderVersion = $state(0);
	let foregroundColor: Color = $state({ r: 0, g: 0, b: 0, a: 255 });
	let recentColors: string[] = $state([]);

	const history = createHistoryManager();
	let historyVersion = $state(0);
	let isDrawing = $state(false);

	const canUndo = $derived.by(() => {
		void historyVersion;
		return history.canUndo;
	});
	const canRedo = $derived.by(() => {
		void historyVersion;
		return history.canRedo;
	});

	const zoomPercent = $derived(Math.round(viewport.zoom * 100));

	function handleViewportChange(newViewport: ViewportConfig): void {
		viewport = newViewport;
	}

	function handleDrawStart(): void {
		isDrawing = true;
		history.pushSnapshot(pixelCanvas.pixels);
		historyVersion++;
		if (activeTool === 'pencil') {
			recentColors = addRecentColor(recentColors, colorToHex(foregroundColor));
		}
	}

	function handleDrawEnd(): void {
		isDrawing = false;
	}

	function handleUndo(): void {
		if (isDrawing) return;
		const snapshot = history.undo(pixelCanvas.pixels);
		if (snapshot) {
			pixelCanvas.pixels.set(snapshot);
			renderVersion++;
			historyVersion++;
		}
	}

	function handleRedo(): void {
		if (isDrawing) return;
		const snapshot = history.redo(pixelCanvas.pixels);
		if (snapshot) {
			pixelCanvas.pixels.set(snapshot);
			renderVersion++;
			historyVersion++;
		}
	}

	function handleClear(): void {
		history.pushSnapshot(pixelCanvas.pixels);
		historyVersion++;
		clearCanvas(pixelCanvas);
		renderVersion++;
	}

	function isInteractiveTarget(target: EventTarget | null): boolean {
		return (
			target instanceof HTMLElement &&
			target.closest('button, input, select, textarea, [contenteditable="true"]') !== null
		);
	}

	function handleKeyDown(event: KeyboardEvent): void {
		if (isInteractiveTarget(event.target)) return;

		const isCtrlOrCmd = event.ctrlKey || event.metaKey;
		const isZKey = event.key.toLowerCase() === 'z';
		if (isCtrlOrCmd && isZKey && !event.shiftKey) {
			event.preventDefault();
			handleUndo();
		} else if (isCtrlOrCmd && isZKey && event.shiftKey) {
			event.preventDefault();
			handleRedo();
		}
	}

	function handleDraw(current: CanvasCoords, previous: CanvasCoords | null): void {
		const pixels = previous
			? interpolatePixels(previous.x, previous.y, current.x, current.y)
			: [current];
		let changed = false;
		for (const p of pixels) {
			if (applyTool(pixelCanvas, p.x, p.y, activeTool, foregroundColor)) {
				changed = true;
			}
		}
		if (changed) renderVersion++;
	}

	function handleZoomIn(): void {
		const centerX = viewportSize.width / 2;
		const centerY = viewportSize.height / 2;
		viewport = zoomAtPoint(viewport, centerX, centerY, nextZoomLevel(viewport.zoom));
	}

	function handleZoomOut(): void {
		const centerX = viewportSize.width / 2;
		const centerY = viewportSize.height / 2;
		viewport = zoomAtPoint(viewport, centerX, centerY, prevZoomLevel(viewport.zoom));
	}

	function handleFit(): void {
		viewport = fitToViewport(viewport, pixelCanvas, viewportSize);
	}

	function handleGridToggle(): void {
		viewport = { ...viewport, showGrid: !viewport.showGrid };
	}

	function handleColorChange(hex: string): void {
		foregroundColor = hexToColor(hex);
	}

	function handleResize(newWidth: number, newHeight: number): void {
		if (newWidth === pixelCanvas.width && newHeight === pixelCanvas.height) return;
		pixelCanvas = resizeCanvas(pixelCanvas, newWidth, newHeight);
		viewport = createDefaultViewport(newWidth, newHeight);
		history.clear();
		historyVersion++;
		renderVersion++;
	}

	async function handleExportPng(): Promise<void> {
		try {
			await exportAsPng(pixelCanvas);
		} catch (error) {
			console.error('PNG export failed:', error);
		}
	}
</script>

<svelte:window onkeydown={handleKeyDown} />

<div class="app">
	<header class="app-header">
		<h1>DOTORIXEL</h1>
	</header>
	<div class="editor-area">
		<div class="canvas-layer">
			<PixelCanvasView
				{pixelCanvas}
				{viewport}
				{viewportSize}
				{renderVersion}
				onDraw={handleDraw}
				onDrawStart={handleDrawStart}
				onDrawEnd={handleDrawEnd}
				onViewportChange={handleViewportChange}
			/>
		</div>
		<div class="panel panel-toolbar">
			<Toolbar
				{activeTool}
				{canUndo}
				{canRedo}
				{zoomPercent}
				showGrid={viewport.showGrid}
				onToolChange={(tool) => (activeTool = tool)}
				onUndo={handleUndo}
				onRedo={handleRedo}
				onZoomIn={handleZoomIn}
				onZoomOut={handleZoomOut}
				onFit={handleFit}
				onGridToggle={handleGridToggle}
				onClear={handleClear}
				onExport={handleExportPng}
			/>
		</div>
		<div class="panel panel-palette">
			<ColorPalette
				selectedColor={colorToHex(foregroundColor)}
				{recentColors}
				onColorChange={handleColorChange}
			/>
		</div>
		<div class="panel panel-settings">
			<CanvasSettings
				canvasWidth={pixelCanvas.width}
				canvasHeight={pixelCanvas.height}
				onResize={handleResize}
			/>
		</div>
		<div class="panel panel-status">
			<StatusBar
				canvasWidth={pixelCanvas.width}
				canvasHeight={pixelCanvas.height}
				{zoomPercent}
				{activeTool}
			/>
		</div>
	</div>
</div>

<style>
	.app {
		display: flex;
		flex-direction: column;
		height: 100vh;
	}

	.app-header {
		padding: var(--space-2) var(--space-4);
		border-bottom: var(--border-width) solid var(--color-border);
		background: var(--color-surface);
	}

	.app-header h1 {
		margin: 0;
		font-size: var(--font-size-lg);
	}

	/* ── Mobile: vertical stack ── */

	.editor-area {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-3);
		flex: 1;
		background: var(--color-muted);
		overflow-y: auto;
	}

	.canvas-layer {
		display: flex;
		align-items: center;
		justify-content: center;
		order: 1;
	}

	.panel-toolbar {
		order: 0;
	}

	.panel-status {
		order: 2;
	}

	.panel-palette {
		order: 3;
	}

	.panel-settings {
		order: 4;
	}

	/* ── Desktop: floating panels over canvas ── */

	@media (min-width: 1024px) {
		.editor-area {
			display: grid;
			grid-template-columns: auto 1fr auto;
			grid-template-rows: auto 1fr auto;
			padding: 0;
			overflow: hidden;
		}

		.canvas-layer {
			grid-column: 1 / -1;
			grid-row: 1 / -1;
			order: unset;
			width: 100%;
			height: 100%;
		}

		.panel {
			z-index: 1;
			pointer-events: none;
			padding: var(--space-3);
		}

		.panel > :global(*) {
			pointer-events: auto;
		}

		.panel-toolbar {
			grid-column: 1 / -1;
			grid-row: 1;
			justify-self: center;
			order: unset;
		}

		.panel-palette {
			grid-column: 1;
			grid-row: 2;
			align-self: start;
			order: unset;
		}

		.panel-settings {
			grid-column: 3;
			grid-row: 2;
			align-self: start;
			order: unset;
		}

		.panel-status {
			grid-column: 1 / -1;
			grid-row: 3;
			justify-self: center;
			order: unset;
		}
	}
</style>
