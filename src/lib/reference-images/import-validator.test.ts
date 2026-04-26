import { describe, it, expect } from 'vitest';
import { validateFile } from './import-validator';

describe('validateFile', () => {
	it('accepts a PNG under the size cap', () => {
		const result = validateFile({ type: 'image/png', size: 1024 });

		expect(result).toEqual({ ok: true });
	});

	it('rejects SVG as unsupported format', () => {
		const result = validateFile({ type: 'image/svg+xml', size: 1024 });

		expect(result).toEqual({ ok: false, reason: 'unsupported-format' });
	});

	it('rejects a file just over 10 MB', () => {
		const oneByteOver = 10 * 1024 * 1024 + 1;
		const result = validateFile({ type: 'image/png', size: oneByteOver });

		expect(result).toEqual({ ok: false, reason: 'too-large' });
	});

	it('accepts a file exactly at 10 MB', () => {
		const exactCap = 10 * 1024 * 1024;
		const result = validateFile({ type: 'image/png', size: exactCap });

		expect(result).toEqual({ ok: true });
	});

	it.each(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])(
		'accepts allowed format %s',
		(type) => {
			const result = validateFile({ type, size: 1024 });

			expect(result).toEqual({ ok: true });
		}
	);

	it.each(['image/heic', 'image/bmp', 'image/tiff', 'application/pdf', ''])(
		'rejects disallowed format %s',
		(type) => {
			const result = validateFile({ type, size: 1024 });

			expect(result).toEqual({ ok: false, reason: 'unsupported-format' });
		}
	);
});
