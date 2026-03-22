<script lang="ts">
	import {
		WasmPixelCanvas,
		WasmViewport,
		WasmHistoryManager,
		WasmColor,
		WasmToolType,
		apply_tool,
		wasm_interpolate_pixels
	} from '$wasm/dotorixel_wasm';
	import type { CanvasCoords, ViewportState } from '$lib/canvas/view-types';
	import type { ToolType } from '$lib/ui-pixel/toolbar-types';
	import { colorToHex, hexToColor, addRecentColor, type Color } from '$lib/canvas/color';
	import { exportAsPng } from '$lib/canvas/export';
	import PixelCanvasView from '$lib/canvas/PixelCanvasView.svelte';
	import Toolbar from '$lib/ui-pixel/Toolbar.svelte';
	import BevelButton from '$lib/ui-pixel/BevelButton.svelte';
	import ColorPalette from '$lib/ui-pixel/ColorPalette.svelte';
	import CanvasSettings from '$lib/ui-pixel/CanvasSettings.svelte';
	import StatusBar from '$lib/ui-pixel/StatusBar.svelte';
	import PixelPanel from '$lib/ui-pixel/PixelPanel.svelte';
	import '$lib/ui-pixel/pixel-tokens.css';

	const WASM_TOOL_MAP = {
		pencil: WasmToolType.Pencil,
		eraser: WasmToolType.Eraser,
		line: WasmToolType.Line
	} as const;

	let pixelCanvas = $state(new WasmPixelCanvas(16, 16));
	const viewportSize = { width: 512, height: 512 };

	let viewportState: ViewportState = $state({
		viewport: WasmViewport.for_canvas(16, 16),
		showGrid: true,
		gridColor: '#cccccc'
	});
	let activeTool = $state<ToolType>('pencil');
	let renderVersion = $state(0);
	let foregroundColor: Color = $state({ r: 0, g: 0, b: 0, a: 255 });
	let recentColors: string[] = $state([]);

	const history = WasmHistoryManager.default_manager();
	let historyVersion = $state(0);
	let isDrawing = $state(false);

	const canUndo = $derived.by(() => {
		void historyVersion;
		return history.can_undo();
	});
	const canRedo = $derived.by(() => {
		void historyVersion;
		return history.can_redo();
	});

	const zoomPercent = $derived(Math.round(viewportState.viewport.zoom * 100));

	let wasmForegroundColor = $derived(
		new WasmColor(foregroundColor.r, foregroundColor.g, foregroundColor.b, foregroundColor.a)
	);

	const renderViewport = $derived({
		pixelSize: viewportState.viewport.pixel_size,
		zoom: viewportState.viewport.zoom,
		panX: viewportState.viewport.pan_x,
		panY: viewportState.viewport.pan_y,
		showGrid: viewportState.showGrid,
		gridColor: viewportState.gridColor
	});

	function handleViewportChange(newViewport: WasmViewport): void {
		const clamped = newViewport.clamp_pan(
			pixelCanvas.width,
			pixelCanvas.height,
			viewportSize.width,
			viewportSize.height
		);
		viewportState = { ...viewportState, viewport: clamped };
	}

	function handleDrawStart(): void {
		isDrawing = true;
		history.push_snapshot(pixelCanvas.pixels());
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
		const snapshot = history.undo(pixelCanvas.pixels());
		if (snapshot) {
			pixelCanvas.restore_pixels(snapshot);
			renderVersion++;
			historyVersion++;
		}
	}

	function handleRedo(): void {
		if (isDrawing) return;
		const snapshot = history.redo(pixelCanvas.pixels());
		if (snapshot) {
			pixelCanvas.restore_pixels(snapshot);
			renderVersion++;
			historyVersion++;
		}
	}

	function handleClear(): void {
		history.push_snapshot(pixelCanvas.pixels());
		historyVersion++;
		pixelCanvas.clear();
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
		const wasmTool = WASM_TOOL_MAP[activeTool];
		let changed = false;

		if (previous) {
			const flat = wasm_interpolate_pixels(previous.x, previous.y, current.x, current.y);
			for (let i = 0; i < flat.length; i += 2) {
				if (apply_tool(pixelCanvas, flat[i], flat[i + 1], wasmTool, wasmForegroundColor)) {
					changed = true;
				}
			}
		} else {
			if (apply_tool(pixelCanvas, current.x, current.y, wasmTool, wasmForegroundColor)) {
				changed = true;
			}
		}

		if (changed) renderVersion++;
	}

	function handleZoomIn(): void {
		const centerX = viewportSize.width / 2;
		const centerY = viewportSize.height / 2;
		const newZoom = WasmViewport.next_zoom_level(viewportState.viewport.zoom);
		const zoomed = viewportState.viewport.zoom_at_point(centerX, centerY, newZoom);
		handleViewportChange(zoomed);
	}

	function handleZoomOut(): void {
		const centerX = viewportSize.width / 2;
		const centerY = viewportSize.height / 2;
		const newZoom = WasmViewport.prev_zoom_level(viewportState.viewport.zoom);
		const zoomed = viewportState.viewport.zoom_at_point(centerX, centerY, newZoom);
		handleViewportChange(zoomed);
	}

	function handleFit(): void {
		const fitted = viewportState.viewport.fit_to_viewport(
			pixelCanvas.width,
			pixelCanvas.height,
			viewportSize.width,
			viewportSize.height
		);
		viewportState = { ...viewportState, viewport: fitted };
	}

	function handleGridToggle(): void {
		viewportState = { ...viewportState, showGrid: !viewportState.showGrid };
	}

	function handleColorChange(hex: string): void {
		foregroundColor = hexToColor(hex);
	}

	function handleResize(newWidth: number, newHeight: number): void {
		if (newWidth === pixelCanvas.width && newHeight === pixelCanvas.height) return;
		pixelCanvas = pixelCanvas.resize(newWidth, newHeight);
		viewportState = {
			...viewportState,
			viewport: WasmViewport.for_canvas(newWidth, newHeight)
		};
		history.clear();
		historyVersion++;
		renderVersion++;
	}

	function handleExportPng(): void {
		try {
			exportAsPng(pixelCanvas);
		} catch (error) {
			console.error('PNG export failed:', error);
		}
	}

</script>

<svelte:window onkeydown={handleKeyDown} />

<div class="pixel-editor">
	<header class="pixel-header">
		<h1>DOTORIXEL</h1>
	</header>
	<main class="editor-area">
		<div class="editor-workspace">
			<div class="cell-toolbar">
				<Toolbar
					Button={BevelButton}
					{activeTool}
					{canUndo}
					{canRedo}
					{zoomPercent}
					showGrid={viewportState.showGrid}
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
			<div class="cell-palette">
				<ColorPalette
					selectedColor={colorToHex(foregroundColor)}
					{recentColors}
					onColorChange={handleColorChange}
				/>
			</div>
			<div class="cell-canvas">
				<PixelPanel style="padding: 0;">
					<PixelCanvasView
						{pixelCanvas}
						{viewportState}
						{viewportSize}
						{renderVersion}
						{renderViewport}
						onDraw={handleDraw}
						onDrawStart={handleDrawStart}
						onDrawEnd={handleDrawEnd}
						onViewportChange={handleViewportChange}
					/>
				</PixelPanel>
			</div>
			<div class="cell-settings">
				<CanvasSettings
					canvasWidth={pixelCanvas.width}
					canvasHeight={pixelCanvas.height}
					onResize={handleResize}
				/>
			</div>
			<div class="cell-status">
				<StatusBar
					canvasWidth={pixelCanvas.width}
					canvasHeight={pixelCanvas.height}
					{zoomPercent}
					{activeTool}
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
