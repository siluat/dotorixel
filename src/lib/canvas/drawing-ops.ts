import type { Color } from './color';
import type { MarqueeRegion } from './canvas-model';

/**
 * Rectangular bounds in canvas pixel coordinates.
 *
 * Bounds use half-open membership: `[x, x + width) x [y, y + height)`.
 * Empty bounds are valid data at this layer and represent a no-op fill region.
 */
export type MarqueeBounds = Pick<MarqueeRegion, 'x' | 'y' | 'width' | 'height'>;

/**
 * The subset of tool types that map to WASM drawing algorithms.
 * Does not include floodfill, eyedropper, or move — those use separate APIs.
 */
export type DrawingToolType = 'pencil' | 'eraser' | 'line' | 'rectangle' | 'ellipse';

/**
 * Drawing operations that tools invoke.
 *
 * Most methods operate on the document captured in the closure at creation time
 * (via `createDrawingOps(getDocument)`), so callers don't pass a target parameter;
 * the getter runs on every call, so writes always hit the current document.
 */
export interface DrawingOps {
	/** Apply a single-pixel tool operation. Returns true if a pixel changed. */
	applyTool(x: number, y: number, tool: DrawingToolType, color: Color): boolean;

	/**
	 * Apply a stroke as a batch of pixels in order. The default implementation
	 * loops over the points and calls `applyTool`; decorators (e.g. pixel-perfect)
	 * can override this to filter or transform the batch as a whole.
	 *
	 * `pixels` is a flat coordinate array `[x0, y0, x1, y1, ...]` (typically the
	 * output of `interpolatePixels`). Returns true if any pixel changed.
	 */
	applyStroke(pixels: Int32Array, tool: DrawingToolType, color: Color): boolean;

	/**
	 * Write a single pixel of arbitrary color, regardless of tool kind. Used by
	 * decorators that need to revert or restore pixels (e.g. pixel-perfect filter).
	 * Out-of-bounds writes are silently dropped. Returns true if the pixel was set.
	 */
	setPixel(x: number, y: number, color: Color): boolean;

	/** Read the color at (x, y). Returns null if out of bounds. */
	getPixel(x: number, y: number): Color | null;

	/**
	 * Fill the connected same-color region from `(x, y)`.
	 *
	 * When `bounds` is provided, pixels outside that rectangle are ignored as
	 * fill candidates. Returns true if any pixel changed, false when the seed is
	 * outside the canvas or bounds, the target color already matches, or no
	 * writable pixel is available.
	 */
	floodFill(x: number, y: number, color: Color, bounds?: MarqueeBounds): boolean;

	/** Bresenham interpolation between two points. Returns flat [x0,y0, x1,y1, ...]. */
	interpolatePixels(x0: number, y0: number, x1: number, y1: number): Int32Array;

	/** Rectangle outline coordinates. Returns flat [x0,y0, x1,y1, ...]. */
	rectangleOutline(x0: number, y0: number, x1: number, y1: number): Int32Array;

	/** Ellipse outline coordinates. Returns flat [x0,y0, x1,y1, ...]. */
	ellipseOutline(x0: number, y0: number, x1: number, y1: number): Int32Array;
}

function isInsideMarquee(marquee: MarqueeBounds, x: number, y: number): boolean {
	return (
		x >= marquee.x &&
		y >= marquee.y &&
		x < marquee.x + marquee.width &&
		y < marquee.y + marquee.height
	);
}

function isNonEmptyBounds(bounds: MarqueeBounds): boolean {
	return bounds.width > 0 && bounds.height > 0;
}

function getBoundsIntersection(a: MarqueeBounds, b: MarqueeBounds): MarqueeBounds | null {
	const x = Math.max(a.x, b.x);
	const y = Math.max(a.y, b.y);
	const right = Math.min(a.x + a.width, b.x + b.width);
	const bottom = Math.min(a.y + a.height, b.y + b.height);
	const width = right - x;
	const height = bottom - y;

	return width > 0 && height > 0 ? { x, y, width, height } : null;
}

/**
 * Wrap drawing operations so writes and bounded fills are clipped to `marquee`.
 *
 * When no Marquee is active, this returns `baseOps` unchanged. When a caller
 * already provides flood-fill bounds, the effective fill region is the
 * intersection of those bounds and the active Marquee. Empty intersections and
 * seeds outside the effective region return false without touching `baseOps`.
 */
export function createMarqueeClippedOps(
	baseOps: DrawingOps,
	marquee: MarqueeBounds | null | undefined
): DrawingOps {
	if (!marquee) return baseOps;

	return {
		applyTool(x, y, tool, color) {
			if (!isInsideMarquee(marquee, x, y)) return false;
			return baseOps.applyTool(x, y, tool, color);
		},
		applyStroke(pixels, tool, color) {
			const clipped: number[] = [];
			for (let i = 0; i + 1 < pixels.length; i += 2) {
				const x = pixels[i];
				const y = pixels[i + 1];
				if (isInsideMarquee(marquee, x, y)) clipped.push(x, y);
			}
			if (clipped.length === 0) return false;
			return baseOps.applyStroke(new Int32Array(clipped), tool, color);
		},
		setPixel(x, y, color) {
			if (!isInsideMarquee(marquee, x, y)) return false;
			return baseOps.setPixel(x, y, color);
		},
		getPixel: baseOps.getPixel.bind(baseOps),
		floodFill(x, y, color, bounds) {
			const effectiveBounds = bounds
				? getBoundsIntersection(marquee, bounds)
				: isNonEmptyBounds(marquee)
					? marquee
					: null;
			if (!effectiveBounds || !isInsideMarquee(effectiveBounds, x, y)) return false;
			return baseOps.floodFill(x, y, color, effectiveBounds);
		},
		interpolatePixels: baseOps.interpolatePixels.bind(baseOps),
		rectangleOutline: baseOps.rectangleOutline.bind(baseOps),
		ellipseOutline: baseOps.ellipseOutline.bind(baseOps)
	};
}
