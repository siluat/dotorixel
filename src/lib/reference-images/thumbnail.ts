export function computeThumbnailDimensions(
	naturalWidth: number,
	naturalHeight: number,
	longestEdge: number
): { w: number; h: number } {
	const longest = Math.max(naturalWidth, naturalHeight);
	const scale = Math.min(1, longestEdge / longest);
	return {
		w: Math.max(1, Math.round(naturalWidth * scale)),
		h: Math.max(1, Math.round(naturalHeight * scale))
	};
}
