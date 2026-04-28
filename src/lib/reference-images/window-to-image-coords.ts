export interface WindowToImageCoordsParams {
	readonly localX: number;
	readonly localY: number;
	readonly displayedWidth: number;
	readonly displayedHeight: number;
	readonly naturalWidth: number;
	readonly naturalHeight: number;
}

export function windowToImageCoords(p: WindowToImageCoordsParams): { x: number; y: number } {
	const rawX = Math.floor((p.localX * p.naturalWidth) / p.displayedWidth);
	const rawY = Math.floor((p.localY * p.naturalHeight) / p.displayedHeight);
	const x = Math.max(0, Math.min(p.naturalWidth - 1, rawX));
	const y = Math.max(0, Math.min(p.naturalHeight - 1, rawY));
	return { x, y };
}
