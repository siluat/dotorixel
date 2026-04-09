/** Returns true when every pixel is fully transparent (all bytes zero). */
export function isBlankCanvas(pixels: Uint8Array): boolean {
	return pixels.every((byte) => byte === 0);
}
