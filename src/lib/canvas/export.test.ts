import { describe, it, expect } from 'vitest';
import { createCanvas } from './canvas.ts';
import { generateExportFilename } from './export.ts';
import type { CanvasSize } from './canvas.ts';

describe('generateExportFilename', () => {
	it('includes canvas dimensions in the filename', () => {
		const canvas = createCanvas(16);
		expect(generateExportFilename(canvas)).toBe('dotorixel-16x16.png');
	});

	it('ends with .png extension', () => {
		const canvas = createCanvas(8);
		expect(generateExportFilename(canvas)).toMatch(/\.png$/);
	});

	it.each([8, 16, 32] as CanvasSize[])('generates correct filename for %dx%d canvas', (size) => {
		const canvas = createCanvas(size);
		expect(generateExportFilename(canvas)).toBe(`dotorixel-${size}x${size}.png`);
	});
});
