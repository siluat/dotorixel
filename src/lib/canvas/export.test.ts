import { describe, it, expect } from 'vitest';
import { generateExportFilename } from './export.ts';

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
