<script lang="ts">
	import { createCanvas, clearCanvas, type CanvasCoords } from '$lib/canvas/canvas';
	import { createDefaultViewport } from '$lib/canvas/renderer';
	import { applyTool, interpolatePixels, type ToolType } from '$lib/canvas/tool';
	import { colorToHex, hexToColor, type Color } from '$lib/canvas/color';
	import PixelCanvasView from '$lib/canvas/PixelCanvasView.svelte';

	const pixelCanvas = createCanvas(16);
	const viewport = createDefaultViewport(16);

	let activeTool: ToolType = $state('pencil');
	let renderVersion = $state(0);

	let foregroundColor: Color = $state({ r: 0, g: 0, b: 0, a: 255 });

	function handleClear(): void {
		clearCanvas(pixelCanvas);
		renderVersion++;
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
</script>

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
		<button class="tool-button" onclick={handleClear}>Clear</button>
		<input
			type="color"
			class="color-picker"
			value={colorToHex(foregroundColor)}
			oninput={(e) => (foregroundColor = hexToColor(e.currentTarget.value))}
		/>
	</div>
	<div class="canvas-container">
		<PixelCanvasView {pixelCanvas} {viewport} {renderVersion} onDraw={handleDraw} />
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

	.canvas-container {
		border: 1px solid #999;
	}
</style>
