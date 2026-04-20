import type { CanvasCoords } from '../canvas-model';
import { CANVAS_CHANGED, NO_EFFECTS, type DragTransformTool } from '../draw-tool';
import { customTool, type AuthoredTool } from '../tool-authoring';

/**
 * Shifts pixel data by (dx, dy) within the same canvas dimensions.
 * Pixels shifted off-canvas are clipped; vacated areas become transparent.
 *
 * Uses row-by-row bulk copy — same algorithm as Rust's `resize_with_anchor`
 * but for same-size canvas with a fixed offset.
 */
export function shiftPixels(
	source: Uint8Array,
	width: number,
	height: number,
	dx: number,
	dy: number
): Uint8Array {
	const result = new Uint8Array(width * height * 4);

	for (let srcY = 0; srcY < height; srcY++) {
		const destY = srcY + dy;
		if (destY < 0 || destY >= height) continue;

		const srcXStart = Math.max(0, -dx);
		const srcXEnd = Math.min(width, width - dx);
		if (srcXStart >= srcXEnd) continue;

		const destXStart = srcXStart + dx;
		const copyLen = (srcXEnd - srcXStart) * 4;
		const srcOffset = (srcY * width + srcXStart) * 4;
		const destOffset = (destY * width + destXStart) * 4;
		result.set(source.subarray(srcOffset, srcOffset + copyLen), destOffset);
	}

	return result;
}

/**
 * Shifts all canvas pixels by drag delta from the initial click point. The
 * first sample marks the anchor; subsequent samples restore the original
 * snapshot and re-shift by the delta so the transform is always relative to
 * the drag origin.
 */
export const moveTool: DragTransformTool & AuthoredTool = customTool({
	id: 'move',
	legacy: {
		kind: 'dragTransform',
		applyTransform(ctx, snapshot, start, current): void {
			const dx = current.x - start.x;
			const dy = current.y - start.y;
			const shifted = shiftPixels(snapshot, ctx.canvas.width, ctx.canvas.height, dx, dy);
			ctx.canvas.restore_pixels(shifted);
		}
	},
	open(host) {
		let snapshot: Uint8Array | null = null;
		let anchor: CanvasCoords | null = null;

		return {
			start() {
				host.history.pushSnapshot();
				snapshot = new Uint8Array(host.pixelCanvas.pixels());
				return NO_EFFECTS;
			},
			draw(current, previous) {
				if (previous === null) {
					anchor = current;
					return NO_EFFECTS;
				}
				if (!anchor || !snapshot) return NO_EFFECTS;
				const dx = current.x - anchor.x;
				const dy = current.y - anchor.y;
				const shifted = shiftPixels(
					snapshot,
					host.pixelCanvas.width,
					host.pixelCanvas.height,
					dx,
					dy
				);
				host.pixelCanvas.restore_pixels(shifted);
				return CANVAS_CHANGED;
			},
			modifierChanged() {
				return NO_EFFECTS;
			},
			end() {
				return NO_EFFECTS;
			}
		};
	}
});
