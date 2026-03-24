import {
	WasmPixelCanvas,
	WasmColor,
	WasmToolType,
	apply_tool
} from '$wasm/dotorixel_wasm';
import type { CanvasCoords } from './view-types';

type ShapePixelsFn = (x0: number, y0: number, x1: number, y1: number) => Int32Array;

/** Handles the snapshot-restore preview cycle shared by all shape tools (line, rectangle, ellipse). */
export class ShapeHandler {
	#shapeStart: CanvasCoords | null = null;
	#previewSnapshot: Uint8Array | null = null;

	constructor(
		private readonly wasmTool: WasmToolType,
		private readonly generatePixels: ShapePixelsFn
	) {}

	captureSnapshot(pixelCanvas: WasmPixelCanvas): void {
		this.#previewSnapshot = new Uint8Array(pixelCanvas.pixels());
	}

	draw(
		pixelCanvas: WasmPixelCanvas,
		current: CanvasCoords,
		previous: CanvasCoords | null,
		drawColor: WasmColor
	): boolean {
		if (previous === null) {
			this.#shapeStart = current;
			return apply_tool(pixelCanvas, current.x, current.y, this.wasmTool, drawColor);
		}

		if (!this.#shapeStart || !this.#previewSnapshot) return false;

		pixelCanvas.restore_pixels(this.#previewSnapshot);

		const flat = this.generatePixels(
			this.#shapeStart.x,
			this.#shapeStart.y,
			current.x,
			current.y
		);
		for (let i = 0; i < flat.length; i += 2) {
			apply_tool(pixelCanvas, flat[i], flat[i + 1], this.wasmTool, drawColor);
		}
		return true;
	}

	reset(): void {
		this.#shapeStart = null;
		this.#previewSnapshot = null;
	}
}
