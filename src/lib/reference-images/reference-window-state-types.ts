/**
 * A Reference Window's full per-document record — its Reference Window
 * Placement (`x`, `y`, `width`, `height`) plus visibility, minimized flag, and
 * stacking order. The single source of truth the shell renders verbatim.
 */
export interface ReferenceWindowState {
	refId: string;
	visible: boolean;
	x: number;
	y: number;
	width: number;
	height: number;
	minimized: boolean;
	zOrder: number;
}
