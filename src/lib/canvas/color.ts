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

export function isValidHex(hex: string): boolean {
	return /^#[0-9a-fA-F]{6}$/.test(hex);
}

export interface HsvColor {
	readonly h: number; // 0-360 (degrees)
	readonly s: number; // 0-1
	readonly v: number; // 0-1
}

export function rgbToHsv(color: Color): HsvColor {
	const r = color.r / 255;
	const g = color.g / 255;
	const b = color.b / 255;

	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const delta = max - min;

	let h = 0;
	if (delta !== 0) {
		if (max === r) {
			h = 60 * (((g - b) / delta) % 6);
		} else if (max === g) {
			h = 60 * ((b - r) / delta + 2);
		} else {
			h = 60 * ((r - g) / delta + 4);
		}
	}
	if (h < 0) h += 360;

	const s = max === 0 ? 0 : delta / max;
	const v = max;

	return { h, s, v };
}

export function hsvToRgb(hsv: HsvColor): Color {
	const { h, s, v } = hsv;
	const c = v * s;
	const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
	const m = v - c;

	let r1: number, g1: number, b1: number;
	if (h < 60) {
		[r1, g1, b1] = [c, x, 0];
	} else if (h < 120) {
		[r1, g1, b1] = [x, c, 0];
	} else if (h < 180) {
		[r1, g1, b1] = [0, c, x];
	} else if (h < 240) {
		[r1, g1, b1] = [0, x, c];
	} else if (h < 300) {
		[r1, g1, b1] = [x, 0, c];
	} else {
		[r1, g1, b1] = [c, 0, x];
	}

	return {
		r: Math.round((r1 + m) * 255),
		g: Math.round((g1 + m) * 255),
		b: Math.round((b1 + m) * 255),
		a: 255,
	};
}

export function addRecentColor(
	recentColors: string[],
	color: string,
	maxCount = 12
): string[] {
	const normalized = color.toLowerCase();
	const filtered = recentColors.filter((c) => c.toLowerCase() !== normalized);
	return [color, ...filtered].slice(0, maxCount);
}
