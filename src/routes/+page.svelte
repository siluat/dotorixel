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

<main>
	<h1>DOTORIXEL</h1>
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
	<ColorPalette
		selectedColor={colorToHex(foregroundColor)}
		{recentColors}
		onColorChange={handleColorChange}
	/>
	<CanvasSettings
		canvasWidth={pixelCanvas.width}
		canvasHeight={pixelCanvas.height}
		onResize={handleResize}
	/>
	<div class="canvas-container">
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
</main>

<style>
	main {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-4);
		padding: 2rem;
	}

	.canvas-container {
		border: 1px solid #999;
	}
</style>
