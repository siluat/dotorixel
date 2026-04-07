/** Canvas dimension validation and presets. */
export interface CanvasConstraints {
	readonly minDimension: number;
	readonly maxDimension: number;
	isValidDimension(value: number): boolean;
	presets(): number[];
}
