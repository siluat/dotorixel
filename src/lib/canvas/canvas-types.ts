/** Discrete pixel position on the art canvas. */
export interface CanvasCoords {
	readonly x: number;
	readonly y: number;
}

/** Anchor point for canvas resize operations. */
export type ResizeAnchor =
	| 'top-left'
	| 'top-center'
	| 'top-right'
	| 'middle-left'
	| 'center'
	| 'middle-right'
	| 'bottom-left'
	| 'bottom-center'
	| 'bottom-right';
