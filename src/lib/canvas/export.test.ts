import { describe, it, expect } from 'vitest';
import {
	generateExportFilename,
	buildExportFilename,
	stripKnownExtension,
	availableFormats
} from './export.ts';

describe('generateExportFilename', () => {
	it('includes canvas dimensions in the filename', () => {
		expect(generateExportFilename({ width: 16, height: 16 })).toBe('dotorixel-16x16.png');
	});

	it('ends with .png extension', () => {
		expect(generateExportFilename({ width: 8, height: 8 })).toMatch(/\.png$/);
	});

	it.each([8, 16, 32])('generates correct filename for %dx%d canvas', (size) => {
		expect(generateExportFilename({ width: size, height: size })).toBe(
			`dotorixel-${size}x${size}.png`
		);
	});
});

describe('buildExportFilename', () => {
	it('combines stem and extension', () => {
		expect(buildExportFilename('my-art', 'png', { width: 16, height: 16 })).toBe('my-art.png');
	});

	it('falls back to default name when stem is empty', () => {
		expect(buildExportFilename('', 'png', { width: 16, height: 16 })).toBe(
			'dotorixel-16x16.png'
		);
	});

	it('falls back to default name when stem is only whitespace', () => {
		expect(buildExportFilename('  ', 'svg', { width: 32, height: 24 })).toBe(
			'dotorixel-32x24.svg'
		);
	});
});

describe('stripKnownExtension', () => {
	it('removes a trailing known extension', () => {
		expect(stripKnownExtension('my-art.png', ['png', 'svg'])).toBe('my-art');
	});

	it('preserves unknown extensions', () => {
		expect(stripKnownExtension('my-art.bmp', ['png', 'svg'])).toBe('my-art.bmp');
	});

	it('preserves input with multiple dots and unknown trailing extension', () => {
		expect(stripKnownExtension('my.art.work', ['png', 'svg'])).toBe('my.art.work');
	});

	it('returns empty string when input is only a known extension', () => {
		expect(stripKnownExtension('.png', ['png', 'svg'])).toBe('');
	});

	it('returns input unchanged when there is no dot', () => {
		expect(stripKnownExtension('myart', ['png', 'svg'])).toBe('myart');
	});

	it('is case-insensitive for extensions', () => {
		expect(stripKnownExtension('my-art.PNG', ['png', 'svg'])).toBe('my-art');
	});
});

describe('availableFormats', () => {
	it('contains a PNG entry with required fields', () => {
		const png = availableFormats.find((f) => f.id === 'png');
		expect(png).toBeDefined();
		expect(png!.label).toBe('PNG');
		expect(png!.extension).toBe('png');
		expect(png!.exportFn).toBeTypeOf('function');
	});

	it('contains an SVG entry with required fields', () => {
		const svg = availableFormats.find((f) => f.id === 'svg');
		expect(svg).toBeDefined();
		expect(svg!.label).toBe('SVG');
		expect(svg!.extension).toBe('svg');
		expect(svg!.exportFn).toBeTypeOf('function');
	});
});
