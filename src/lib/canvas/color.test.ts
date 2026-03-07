import { describe, it, expect } from 'vitest';
import { colorToHex, hexToColor, TRANSPARENT } from './color.ts';
import type { Color } from './color.ts';

describe('colorToHex', () => {
	it('converts black to #000000', () => {
		expect(colorToHex({ r: 0, g: 0, b: 0, a: 255 })).toBe('#000000');
	});

	it('converts white to #ffffff', () => {
		expect(colorToHex({ r: 255, g: 255, b: 255, a: 255 })).toBe('#ffffff');
	});

	it('converts an arbitrary color correctly', () => {
		expect(colorToHex({ r: 171, g: 205, b: 239, a: 255 })).toBe('#abcdef');
	});

	it('pads single-digit hex values with zero', () => {
		expect(colorToHex({ r: 1, g: 2, b: 3, a: 255 })).toBe('#010203');
	});

	it('ignores alpha channel', () => {
		expect(colorToHex({ r: 255, g: 0, b: 0, a: 128 })).toBe('#ff0000');
		expect(colorToHex({ r: 255, g: 0, b: 0, a: 0 })).toBe('#ff0000');
	});
});

describe('hexToColor', () => {
	it('parses #000000 to black with full opacity', () => {
		expect(hexToColor('#000000')).toEqual({ r: 0, g: 0, b: 0, a: 255 });
	});

	it('parses #ffffff to white with full opacity', () => {
		expect(hexToColor('#ffffff')).toEqual({ r: 255, g: 255, b: 255, a: 255 });
	});

	it('parses an arbitrary hex color correctly', () => {
		expect(hexToColor('#abcdef')).toEqual({ r: 171, g: 205, b: 239, a: 255 });
	});

	it('parses uppercase hex', () => {
		expect(hexToColor('#FF8800')).toEqual({ r: 255, g: 136, b: 0, a: 255 });
	});

	it('always returns alpha 255', () => {
		const color = hexToColor('#123456');
		expect(color.a).toBe(255);
	});
});

describe('colorToHex / hexToColor round-trip', () => {
	it('round-trips an opaque color', () => {
		const original: Color = { r: 42, g: 128, b: 200, a: 255 };
		expect(hexToColor(colorToHex(original))).toEqual(original);
	});
});

describe('TRANSPARENT', () => {
	it('has all channels set to zero', () => {
		expect(TRANSPARENT).toEqual({ r: 0, g: 0, b: 0, a: 0 });
	});
});
