<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import PixelCanvasView from './PixelCanvasView.svelte';
	import { WasmPixelCanvas, WasmColor, WasmViewport } from '$wasm/dotorixel_wasm';
	import type { ViewportState } from './view-types';

	const { Story } = defineMeta({
		component: PixelCanvasView
	});

	const RED = new WasmColor(255, 0, 0, 255);
	const BLUE = new WasmColor(0, 100, 255, 255);

	function makeViewportState(width: number, height: number): ViewportState {
		return {
			viewport: WasmViewport.for_canvas(width, height),
			showGrid: true,
			gridColor: '#cccccc'
		};
	}

	function makeRenderViewport(vs: ViewportState) {
		return {
			pixelSize: vs.viewport.pixel_size,
			zoom: vs.viewport.zoom,
			panX: vs.viewport.pan_x,
			panY: vs.viewport.pan_y,
			showGrid: vs.showGrid,
			gridColor: vs.gridColor
		};
	}

	function createEmpty() {
		const pixelCanvas = new WasmPixelCanvas(16, 16);
		const viewportState = makeViewportState(16, 16);
		return { pixelCanvas, viewportState, renderViewport: makeRenderViewport(viewportState) };
	}

	function createCheckerboard() {
		const pixelCanvas = new WasmPixelCanvas(16, 16);
		for (let y = 0; y < 16; y++) {
			for (let x = 0; x < 16; x++) {
				const isEven = (x + y) % 2 === 0;
				pixelCanvas.set_pixel(x, y, isEven ? RED : BLUE);
			}
		}
		const viewportState = makeViewportState(16, 16);
		return { pixelCanvas, viewportState, renderViewport: makeRenderViewport(viewportState) };
	}

	function createFilled() {
		const pixelCanvas = WasmPixelCanvas.with_color(8, 8, RED);
		const viewportState = makeViewportState(8, 8);
		return { pixelCanvas, viewportState, renderViewport: makeRenderViewport(viewportState) };
	}
</script>

<Story name="Empty 16x16" args={createEmpty()} />

<Story name="Checkerboard 16x16" args={createCheckerboard()} />

<Story name="Filled 8x8" args={createFilled()} />
