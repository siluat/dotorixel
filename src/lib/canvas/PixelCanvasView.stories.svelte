<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import PixelCanvasView from './PixelCanvasView.svelte';
	import { createCanvas, createCanvasWithColor, setPixel } from './canvas.ts';
	import { createDefaultViewport } from './viewport.ts';
	import type { Color } from './color.ts';

	const { Story } = defineMeta({
		title: 'Canvas/PixelCanvasView',
		component: PixelCanvasView
	});

	const RED: Color = { r: 255, g: 0, b: 0, a: 255 };
	const BLUE: Color = { r: 0, g: 100, b: 255, a: 255 };

	function createCheckerboard() {
		const canvas = createCanvas(16);
		for (let y = 0; y < 16; y++) {
			for (let x = 0; x < 16; x++) {
				const isEven = (x + y) % 2 === 0;
				setPixel(canvas, x, y, isEven ? RED : BLUE);
			}
		}
		return canvas;
	}
</script>

<Story name="Empty 16x16" args={{
	pixelCanvas: createCanvas(16),
	viewport: createDefaultViewport(16)
}} />

<Story name="Checkerboard 16x16" args={{
	pixelCanvas: createCheckerboard(),
	viewport: createDefaultViewport(16)
}} />

<Story name="Filled 8x8" args={{
	pixelCanvas: createCanvasWithColor(8, RED),
	viewport: createDefaultViewport(8)
}} />
