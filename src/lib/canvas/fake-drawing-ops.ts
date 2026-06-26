import type { Document, MarqueeRegion, PixelCanvas } from './canvas-model';
import type { Color } from './color';
import type { DrawingOps, DrawingToolType, MarqueeBounds } from './drawing-ops';

export const WHITE: Color = { r: 255, g: 255, b: 255, a: 255 };
export const BLACK: Color = { r: 0, g: 0, b: 0, a: 255 };
export const TRANSPARENT: Color = { r: 0, g: 0, b: 0, a: 0 };

export function colorsEqual(a: Color, b: Color): boolean {
	return a.r === b.r && a.g === b.g && a.b === b.b && a.a === b.a;
}

export interface FakeDrawingOps extends DrawingOps {
	readonly snapshot: () => Map<string, Color>;
}

/**
 * In-memory DrawingOps for unit tests. Initial pixel color is `initial`;
 * pencil writes the requested color, eraser writes transparent. Out-of-bounds
 * writes are dropped. `applyStroke` models each pixel pair as an independent
 * `applyTool` — no Bresenham interpolation, no dedup. Geometry helpers
 * (`interpolatePixels`, `rectangleOutline`, `ellipseOutline`) stay
 * unimplemented; tests that need them should stub via mocks.
 */
export function createFakeDrawingOps(
	width: number,
	height: number,
	initial: Color
): FakeDrawingOps {
	const pixels = new Map<string, Color>();
	const key = (x: number, y: number) => `${x},${y}`;
	const isInBounds = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height;
	const isInFillBounds = (bounds: MarqueeBounds | undefined, x: number, y: number) =>
		!bounds ||
		(x >= bounds.x &&
			y >= bounds.y &&
			x < bounds.x + bounds.width &&
			y < bounds.y + bounds.height);
	const colorFor = (kind: DrawingToolType, color: Color): Color =>
		kind === 'eraser' ? TRANSPARENT : color;

	function applyToolImpl(x: number, y: number, kind: DrawingToolType, color: Color): boolean {
		if (!isInBounds(x, y)) return false;
		const before = pixels.get(key(x, y)) ?? initial;
		const after = colorFor(kind, color);
		if (colorsEqual(before, after)) return false;
		pixels.set(key(x, y), after);
		return true;
	}

		return {
			applyTool: applyToolImpl,
			setPixel(x, y, color) {
				if (!isInBounds(x, y)) return false;
				pixels.set(key(x, y), color);
				return true;
			},
			getPixel(x, y) {
				if (!isInBounds(x, y)) return null;
				return pixels.get(key(x, y)) ?? initial;
			},
		applyStroke(points, kind, color) {
			let changed = false;
			for (let i = 0; i + 1 < points.length; i += 2) {
				if (applyToolImpl(points[i], points[i + 1], kind, color)) changed = true;
			}
			return changed;
			},
			floodFill(x, y, color, bounds) {
				if (!isInBounds(x, y) || !isInFillBounds(bounds, x, y)) return false;
			const targetColor = pixels.get(key(x, y)) ?? initial;
			if (colorsEqual(targetColor, color)) return false;

			const queue: Array<readonly [number, number]> = [[x, y]];
			const visited = new Set<string>([key(x, y)]);
			let changed = false;

			for (let head = 0; head < queue.length; head++) {
				const [cx, cy] = queue[head];
				const before = pixels.get(key(cx, cy)) ?? initial;
				if (!colorsEqual(before, targetColor)) continue;
				pixels.set(key(cx, cy), color);
				changed = true;

				for (const [dx, dy] of [
					[0, -1],
					[0, 1],
					[-1, 0],
					[1, 0]
				] as const) {
					const nx = cx + dx;
					const ny = cy + dy;
					const nextKey = key(nx, ny);
					if (
						visited.has(nextKey) ||
						!isInBounds(nx, ny) ||
						!isInFillBounds(bounds, nx, ny)
					) {
						continue;
					}
					visited.add(nextKey);
					queue.push([nx, ny]);
				}
			}

			return changed;
		},
		interpolatePixels: () => new Int32Array(),
		rectangleOutline: () => new Int32Array(),
		ellipseOutline: () => new Int32Array(),
		snapshot: () => new Map(pixels)
	};
}

export interface FakePixelCanvas extends PixelCanvas {
	/** Every `Uint8Array` passed to `restore_pixels`, in call order. */
	readonly restoreCalls: ReadonlyArray<Uint8Array>;
}

/**
 * In-memory PixelCanvas stub for session tests. Tracks every `restore_pixels`
 * call so tests can assert snapshot-restore behavior without a WASM canvas.
 * `encode_png`/`encode_svg`/`resize` throw to flag misuse — extend as needed.
 */
export function createFakePixelCanvas(width: number, height: number): FakePixelCanvas {
	const state = new Uint8Array(width * height * 4);
	const restoreCalls: Uint8Array[] = [];
	return {
		width,
		height,
		pixels: () => new Uint8Array(state),
		get_pixel: (x, y) => {
			if (x < 0 || y < 0 || x >= width || y >= height) {
				return { r: 0, g: 0, b: 0, a: 0 };
			}
			const i = (y * width + x) * 4;
			return { r: state[i], g: state[i + 1], b: state[i + 2], a: state[i + 3] };
		},
		restore_pixels(data) {
			restoreCalls.push(new Uint8Array(data));
			state.set(data);
		},
		is_inside_bounds: (x, y) => x >= 0 && y >= 0 && x < width && y < height,
		clear() {
			state.fill(0);
		},
		encode_png: () => {
			throw new Error('createFakePixelCanvas: encode_png not implemented');
		},
		encode_svg: () => {
			throw new Error('createFakePixelCanvas: encode_svg not implemented');
		},
		resize: () => {
			throw new Error('createFakePixelCanvas: resize not implemented');
		},
		get restoreCalls() {
			return restoreCalls;
		}
	};
}

export interface FakeDocument extends Document {
	/** Every `Uint8Array` passed to `restore_active_layer_pixels`, in call order. */
	readonly restoreActiveLayerCalls: ReadonlyArray<Uint8Array>;
}

/**
 * In-memory single-layer Document stub for tool authoring tests. Tracks every
 * `restore_active_layer_pixels` call so tests can assert snapshot-restore
 * behavior without a WASM document. Active-layer id is fixed at `'active'`;
 * `composite()` returns the active layer's pixel buffer.
 */
export function createFakeDocument(width: number, height: number): FakeDocument {
	const pixels = new Uint8Array(width * height * 4);
	const restoreCalls: Uint8Array[] = [];
	let timelinePanelCollapsed = false;
	let marquee: MarqueeRegion | undefined;
	return {
		width,
		height,
		composite: () => new Uint8Array(pixels),
		composite_for_export: () => new Uint8Array(pixels),
		composite_at: (frameId) => {
			if (frameId !== 'frame') {
				throw new Error(`createFakeDocument: unknown frame id: ${frameId}`);
			}
			return new Uint8Array(pixels);
		},
		get_pixel: (x, y) => {
			if (x < 0 || y < 0 || x >= width || y >= height) {
				return { r: 0, g: 0, b: 0, a: 0 };
			}
			const i = (y * width + x) * 4;
			return { r: pixels[i], g: pixels[i + 1], b: pixels[i + 2], a: pixels[i + 3] };
		},
		try_get_pixel: (x, y) => {
			if (x < 0 || y < 0 || x >= width || y >= height) return undefined;
			const i = (y * width + x) * 4;
			return { r: pixels[i], g: pixels[i + 1], b: pixels[i + 2], a: pixels[i + 3] };
		},
		active_layer_id: () => 'active',
		marquee: () => marquee,
		set_marquee(region) {
			marquee = region ?? undefined;
		},
		lift_marquee_pixels: () => new Uint8Array(),
		clear_marquee_pixels() {},
		flip_horizontal() {},
		flip_vertical() {},
		rotate_cw() {},
		rotate_ccw() {},
		composite_buffer_at() {},
		next_layer_number: () => 2,
		is_timeline_panel_collapsed: () => timelinePanelCollapsed,
		set_timeline_panel_collapsed(collapsed) {
			timelinePanelCollapsed = collapsed;
		},
		layer_count: () => 1,
		layers_metadata: () => [
			{
				id: 'active',
				name: 'Layer 1',
				visible: true,
				opacity: 1.0,
				kind: 'pixel',
				source_fingerprint: undefined,
				natural_width: undefined,
				natural_height: undefined,
				placement: undefined
			}
		],
		layer_pixels_at: (index) => (index === 0 ? new Uint8Array(pixels) : undefined),
		restore_active_layer_pixels(data) {
			restoreCalls.push(new Uint8Array(data));
			pixels.set(data);
		},
		add_layer: () => {
			throw new Error('createFakeDocument: add_layer not implemented');
		},
		add_reference_layer: () => {
			throw new Error('createFakeDocument: add_reference_layer not implemented');
		},
		remove_layer: () => {
			throw new Error('createFakeDocument: remove_layer not implemented');
		},
		set_active_layer: (id) => {
			if (id !== 'active') {
				throw new Error(`createFakeDocument: unknown layer id: ${id}`);
			}
		},
		reorder_layer: () => {
			throw new Error('createFakeDocument: reorder_layer not implemented');
		},
		set_reference_placement: () => {
			throw new Error('createFakeDocument: set_reference_placement not implemented');
		},
		set_layer_visibility: () => {
			throw new Error('createFakeDocument: set_layer_visibility not implemented');
		},
		layer_source_pixels_at: () => undefined,
		active_frame_id: () => 'frame',
		frame_count: () => 1,
		frames_metadata: () => [{ id: 'frame', duration_ms: 100 }],
		cel_pixels_at: (layerIndex, frameId) =>
			layerIndex === 0 && frameId === 'frame' ? new Uint8Array(pixels) : undefined,
		add_frame: () => {
			throw new Error('createFakeDocument: add_frame not implemented');
		},
		duplicate_frame: () => {
			throw new Error('createFakeDocument: duplicate_frame not implemented');
		},
		remove_frame: () => {
			throw new Error('createFakeDocument: remove_frame not implemented');
		},
		reorder_frame: () => {
			throw new Error('createFakeDocument: reorder_frame not implemented');
		},
		set_active_frame: (id) => {
			if (id !== 'frame') {
				throw new Error(`createFakeDocument: unknown frame id: ${id}`);
			}
		},
		set_frame_duration: () => {
			throw new Error('createFakeDocument: set_frame_duration not implemented');
		},
		get restoreActiveLayerCalls() {
			return restoreCalls;
		}
	};
}
