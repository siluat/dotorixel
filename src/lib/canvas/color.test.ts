import { describe, it, expect } from 'vitest';
import { colorToHex, hexToColor, isValidHex, addRecentColor, TRANSPARENT, type Color } from './color.ts';

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

describe('isValidHex', () => {
	it('accepts valid 6-digit hex with #', () => {
		expect(isValidHex('#ff0000')).toBe(true);
		expect(isValidHex('#ABCDEF')).toBe(true);
		expect(isValidHex('#000000')).toBe(true);
	});

	it('rejects empty string', () => {
		expect(isValidHex('')).toBe(false);
	});

	it('rejects hex without # prefix', () => {
		expect(isValidHex('ff0000')).toBe(false);
	});

	it('rejects 3-digit shorthand', () => {
		expect(isValidHex('#fff')).toBe(false);
	});

	it('rejects invalid characters', () => {
		expect(isValidHex('#gggggg')).toBe(false);
		expect(isValidHex('#zzzzzz')).toBe(false);
	});

	it('rejects hex with extra characters', () => {
		expect(isValidHex('#ff000000')).toBe(false);
	});
});

describe('addRecentColor', () => {
	it('adds to an empty list', () => {
		expect(addRecentColor([], '#ff0000')).toEqual(['#ff0000']);
	});

	it('prepends new color', () => {
		expect(addRecentColor(['#00ff00'], '#ff0000')).toEqual(['#ff0000', '#00ff00']);
	});

	it('moves duplicate to front', () => {
		const recent = ['#00ff00', '#ff0000', '#0000ff'];
		expect(addRecentColor(recent, '#0000ff')).toEqual(['#0000ff', '#00ff00', '#ff0000']);
	});

	it('handles case-insensitive duplicates', () => {
		const recent = ['#FF0000', '#00ff00'];
		expect(addRecentColor(recent, '#ff0000')).toEqual(['#ff0000', '#00ff00']);
	});

	it('trims when exceeding maxCount', () => {
		const recent = ['#111111', '#222222', '#333333'];
		const result = addRecentColor(recent, '#000000', 3);
		expect(result).toEqual(['#000000', '#111111', '#222222']);
		expect(result).toHaveLength(3);
	});

	it('does not mutate original array', () => {
		const original = ['#ff0000', '#00ff00'];
		const copy = [...original];
		addRecentColor(original, '#0000ff');
		expect(original).toEqual(copy);
	});
});
