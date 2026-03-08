export interface Color {
	readonly r: number;
	readonly g: number;
	readonly b: number;
	readonly a: number;
}

export const TRANSPARENT: Color = { r: 0, g: 0, b: 0, a: 0 };

export function colorToHex(color: Color): string {
	const r = color.r.toString(16).padStart(2, '0');
	const g = color.g.toString(16).padStart(2, '0');
	const b = color.b.toString(16).padStart(2, '0');
	return `#${r}${g}${b}`;
}

export function hexToColor(hex: string): Color {
	const r = parseInt(hex.slice(1, 3), 16);
	const g = parseInt(hex.slice(3, 5), 16);
	const b = parseInt(hex.slice(5, 7), 16);
	return { r, g, b, a: 255 };
}
