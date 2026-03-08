<script lang="ts">
	import { createCanvas, clearCanvas, type CanvasCoords } from '$lib/canvas/canvas';
	import {
		createDefaultViewport,
		zoomAtPoint,
		fitToViewport,
		nextZoomLevel,
		prevZoomLevel,
		type ViewportConfig
	} from '$lib/canvas/viewport';
	import { applyTool, interpolatePixels, type ToolType } from '$lib/canvas/tool';
	import { colorToHex, hexToColor, type Color } from '$lib/canvas/color';
	import { createHistoryManager } from '$lib/canvas/history';
	import PixelCanvasView from '$lib/canvas/PixelCanvasView.svelte';

	const pixelCanvas = createCanvas(16);
	const viewportSize = { width: 512, height: 512 };

	let viewport: ViewportConfig = $state(createDefaultViewport(16));
	let activeTool: ToolType = $state('pencil');
	let renderVersion = $state(0);
	let foregroundColor: Color = $state({ r: 0, g: 0, b: 0, a: 255 });

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
</script>

<svelte:window onkeydown={handleKeyDown} />

<main>
	<h1>DOTORIXEL</h1>
	<div class="toolbar">
		<button
			class="tool-button"
			class:active={activeTool === 'pencil'}
			onclick={() => (activeTool = 'pencil')}
		>
			Pencil
		</button>
		<button
			class="tool-button"
			class:active={activeTool === 'eraser'}
			onclick={() => (activeTool = 'eraser')}
		>
			Eraser
		</button>
		<input
			type="color"
			class="color-picker"
			value={colorToHex(foregroundColor)}
			oninput={(e) => (foregroundColor = hexToColor(e.currentTarget.value))}
		/>
		<span class="separator"></span>
		<button class="tool-button" onclick={handleUndo} disabled={!canUndo}>Undo</button>
		<button class="tool-button" onclick={handleRedo} disabled={!canRedo}>Redo</button>
		<button class="tool-button" onclick={handleClear}>Clear</button>
		<span class="separator"></span>
		<button class="tool-button" onclick={handleZoomOut}>−</button>
		<span class="zoom-label">{zoomPercent}%</span>
		<button class="tool-button" onclick={handleZoomIn}>+</button>
		<button class="tool-button" onclick={handleFit}>Fit</button>
	</div>
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
		padding: 2rem;
	}

	h1 {
		margin-bottom: 1.5rem;
	}

	.toolbar {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		margin-bottom: 1rem;
	}

	.tool-button {
		padding: 0.5rem 1rem;
		border: 1px solid #999;
		background: #f0f0f0;
		cursor: pointer;
		font-size: 0.875rem;
	}

	.color-picker {
		width: 2.25rem;
		height: 2.25rem;
		padding: 0.125rem;
		border: 1px solid #999;
		border-radius: 0;
		background: #f0f0f0;
		cursor: pointer;
		margin-left: 0.5rem;
	}

	.tool-button.active {
		background: #333;
		color: #fff;
		border-color: #333;
	}

	.separator {
		width: 1px;
		height: 1.5rem;
		background: #ccc;
		margin: 0 0.25rem;
	}

	.zoom-label {
		font-size: 0.875rem;
		min-width: 3.5rem;
		text-align: center;
		font-variant-numeric: tabular-nums;
	}

	.canvas-container {
		border: 1px solid #999;
	}
</style>
