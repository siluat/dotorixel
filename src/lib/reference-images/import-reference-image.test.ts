// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { importReferenceImage } from './import-reference-image';

function makeFile(opts: { type: string; size: number; name?: string }): File {
	const data = new Uint8Array(opts.size);
	return new File([data], opts.name ?? 'test', { type: opts.type });
}

describe('importReferenceImage', () => {
	it('returns unsupported-format error for SVG input', async () => {
		const result = await importReferenceImage(makeFile({ type: 'image/svg+xml', size: 100 }));

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.kind).toBe('unsupported-format');
		}
	});

	it('returns too-large error for files over 10 MB', async () => {
		const oneByteOver = 10 * 1024 * 1024 + 1;
		const result = await importReferenceImage(makeFile({ type: 'image/png', size: oneByteOver }));

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.kind).toBe('too-large');
		}
	});
});
