// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
	generateExportFilename,
	buildExportFilename,
	stripKnownExtension,
	availableFormats,
	exportAs,
	exportAsSpritesheet,
	type DocumentExportFormat,
	type ExportSources,
	type StillExportFormat
} from './export.ts';

function fakeStillFormat(exportFn: StillExportFormat['exportFn'] = vi.fn()): StillExportFormat {
	return {
		id: 'fake-still',
		label: () => 'Fake Still',
		extension: 'fst',
		source: 'still',
		exportFn
	};
}

function fakeDocumentFormat(
	exportFn: DocumentExportFormat['exportFn'] = vi.fn()
): DocumentExportFormat {
	return {
		id: 'fake-doc',
		label: () => 'Fake Doc',
		extension: 'fdoc',
		source: 'document',
		exportFn
	};
}

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
		expect(buildExportFilename('my-art', 'png', 'dotorixel-16x16')).toBe('my-art.png');
	});

	it('falls back to the fallback stem when stem is empty', () => {
		expect(buildExportFilename('', 'png', 'dotorixel-16x16')).toBe('dotorixel-16x16.png');
	});

	it('falls back to the fallback stem when stem is only whitespace', () => {
		expect(buildExportFilename('  ', 'svg', 'dotorixel-32x24')).toBe('dotorixel-32x24.svg');
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

describe('exportAs', () => {
	it('hands still-source formats the still snapshot and the assembled filename', () => {
		const exportFn = vi.fn();
		const snapshot = { width: 16, height: 16 };
		const sources: ExportSources = {
			still: () => snapshot,
			document: () => ({ width: 16, height: 16 })
		};

		exportAs(fakeStillFormat(exportFn), 'my-art', sources);

		expect(exportFn).toHaveBeenCalledExactlyOnceWith(snapshot, 'my-art.fst');
	});

	it('hands document-source formats the Document and the assembled filename', () => {
		const exportFn = vi.fn();
		const document = { width: 32, height: 24 };
		const sources: ExportSources = {
			still: () => ({ width: 32, height: 24 }),
			document: () => document
		};

		exportAs(fakeDocumentFormat(exportFn), 'my-anim', sources);

		expect(exportFn).toHaveBeenCalledExactlyOnceWith(document, 'my-anim.fdoc');
	});

	it('resolves only the declared source, never the other one', () => {
		const still = vi.fn(() => ({ width: 16, height: 16 }));
		const document = vi.fn(() => ({ width: 16, height: 16 }));

		exportAs(fakeStillFormat(), 'a', { still, document });
		expect(document).not.toHaveBeenCalled();

		exportAs(fakeDocumentFormat(), 'b', { still, document });
		expect(still).toHaveBeenCalledTimes(1);
		expect(document).toHaveBeenCalledTimes(1);
	});

	it('falls back to the default stem derived from the resolved source dimensions', () => {
		const exportFn = vi.fn();
		const sources: ExportSources = {
			still: () => ({ width: 1, height: 1 }),
			document: () => ({ width: 32, height: 24 })
		};

		exportAs(fakeDocumentFormat(exportFn), '', sources);

		expect(exportFn).toHaveBeenCalledExactlyOnceWith(expect.anything(), 'dotorixel-32x24.fdoc');
	});

	it('prefers the format-declared default stem over the shared one', () => {
		const exportFn = vi.fn();
		const format: DocumentExportFormat = {
			...fakeDocumentFormat(exportFn),
			defaultStem: ({ width, height }) => `custom-${width}x${height}`
		};
		const sources: ExportSources = {
			still: () => ({ width: 1, height: 1 }),
			document: () => ({ width: 32, height: 24 })
		};

		exportAs(format, '  ', sources);

		expect(exportFn).toHaveBeenCalledExactlyOnceWith(expect.anything(), 'custom-32x24.fdoc');
	});

	it('strips a registry-known extension typed into the stem', () => {
		const exportFn = vi.fn();
		const sources: ExportSources = {
			still: () => ({ width: 16, height: 16 }),
			document: () => ({ width: 16, height: 16 })
		};

		exportAs(fakeStillFormat(exportFn), ' my-art.png ', sources);

		expect(exportFn).toHaveBeenCalledExactlyOnceWith(expect.anything(), 'my-art.fst');
	});

	it('reports the resolved source dimensions so callers can record analytics', () => {
		const sources: ExportSources = {
			still: () => ({ width: 16, height: 8 }),
			document: () => ({ width: 32, height: 24 })
		};

		expect(exportAs(fakeStillFormat(), 'a', sources)).toEqual({ width: 16, height: 8 });
		expect(exportAs(fakeDocumentFormat(), 'b', sources)).toEqual({ width: 32, height: 24 });
	});
});

describe('availableFormats', () => {
	it('contains a PNG entry declared as a still-source format', () => {
		const png = availableFormats.find((f) => f.id === 'png');
		expect(png).toBeDefined();
		expect(png!.label()).toBe('PNG');
		expect(png!.extension).toBe('png');
		expect(png!.source).toBe('still');
		expect(png!.exportFn).toBeTypeOf('function');
	});

	it('contains an SVG entry declared as a still-source format', () => {
		const svg = availableFormats.find((f) => f.id === 'svg');
		expect(svg).toBeDefined();
		expect(svg!.label()).toBe('SVG');
		expect(svg!.extension).toBe('svg');
		expect(svg!.source).toBe('still');
		expect(svg!.exportFn).toBeTypeOf('function');
	});

	it('contains a Spritesheet entry declared as a document-source format', () => {
		const spritesheet = availableFormats.find((f) => f.id === 'spritesheet');
		expect(spritesheet).toBeDefined();
		expect(spritesheet!.label()).toBe('Spritesheet');
		expect(spritesheet!.extension).toBe('png');
		expect(spritesheet!.source).toBe('document');
		expect(spritesheet!.exportFn).toBeTypeOf('function');
	});

	it('marks the spritesheet default stem so it never collides with the still-PNG default', () => {
		const spritesheet = availableFormats.find((f) => f.id === 'spritesheet');
		expect(spritesheet!.defaultStem!({ width: 16, height: 16 })).toBe('dotorixel-16x16-sheet');
	});
});

describe('exportAsSpritesheet', () => {
	function stubDownloadPlumbing() {
		const createObjectURL = vi.fn((_blob: Blob) => 'blob:fake');
		const revokeObjectURL = vi.fn();
		vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
		const click = vi
			.spyOn(HTMLAnchorElement.prototype, 'click')
			.mockImplementation(() => {});
		return { createObjectURL, click };
	}

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('encodes the Document and downloads it as an image/png blob under the given filename', () => {
		const { createObjectURL, click } = stubDownloadPlumbing();
		const encode = vi.fn(() => new Uint8Array([1, 2, 3]));
		const doc = { width: 2, height: 2, encode_spritesheet_png: encode };

		exportAsSpritesheet(doc, 'walk-cycle.png');

		expect(encode).toHaveBeenCalledOnce();
		const blob = createObjectURL.mock.calls[0]![0];
		expect(blob.type).toBe('image/png');
		expect(click).toHaveBeenCalledOnce();
		expect((click.mock.instances[0] as HTMLAnchorElement).download).toBe('walk-cycle.png');
	});

	it('silently skips a Document that lacks the spritesheet encoder', () => {
		const { createObjectURL } = stubDownloadPlumbing();

		exportAsSpritesheet({ width: 2, height: 2 }, 'walk-cycle.png');

		expect(createObjectURL).not.toHaveBeenCalled();
	});
});
