<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import PixelCanvasView from './PixelCanvasView.svelte';
	import type { Color } from './color';
	import { canvasFactory, viewportOps } from './wasm-backend';

	const { Story } = defineMeta({
		component: PixelCanvasView
	});

	const RED: Color = { r: 255, g: 0, b: 0, a: 255 };
	const BLUE: Color = { r: 0, g: 100, b: 255, a: 255 };

	function createEmpty() {
		const pixelCanvas = canvasFactory.create(16, 16);
		const viewport = viewportOps.forCanvas(16, 16);
		return { pixelCanvas, viewport };
	}

	function createCheckerboard() {
		const width = 16;
		const height = 16;
		const pixels = new Uint8Array(width * height * 4);
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				const idx = (y * width + x) * 4;
				const color = (x + y) % 2 === 0 ? RED : BLUE;
				pixels[idx] = color.r;
				pixels[idx + 1] = color.g;
				pixels[idx + 2] = color.b;
				pixels[idx + 3] = color.a;
			}
		}
		const pixelCanvas = canvasFactory.fromPixels(width, height, pixels);
		const viewport = viewportOps.forCanvas(width, height);
		return { pixelCanvas, viewport };
	}

	function createFilled() {
		const pixelCanvas = canvasFactory.withColor(8, 8, RED);
		const viewport = viewportOps.forCanvas(8, 8);
		return { pixelCanvas, viewport };
	}
</script>

<Story name="Empty 16x16" args={createEmpty()} />

<Story name="Checkerboard 16x16" args={createCheckerboard()} />

<Story name="Filled 8x8" args={createFilled()} />
