// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { importReferenceFiles } from './import-reference-files';
import * as singleImport from './import-reference-image';
import type { ReferenceImage } from './reference-image-types';

function makeFile(name: string, type = 'image/png', size = 1): File {
	const data = new Uint8Array(size);
	return new File([data], name, { type });
}

function fakeReference(id: string): ReferenceImage {
	return {
		id,
		filename: `${id}.png`,
		blob: new Blob([new Uint8Array([0])], { type: 'image/png' }),
		thumbnail: new Blob([new Uint8Array([0])], { type: 'image/png' }),
		mimeType: 'image/png',
		naturalWidth: 10,
		naturalHeight: 10,
		byteSize: 1,
		addedAt: new Date('2026-04-29T00:00:00Z')
	};
}

beforeEach(() => {
	vi.spyOn(singleImport, 'importReferenceImage').mockReset();
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('importReferenceFiles', () => {
	it('imports every valid file and returns them in input order', async () => {
		const files = [makeFile('a.png'), makeFile('b.png')];
		vi.spyOn(singleImport, 'importReferenceImage')
			.mockResolvedValueOnce({ ok: true, reference: fakeReference('a') })
			.mockResolvedValueOnce({ ok: true, reference: fakeReference('b') });

		const result = await importReferenceFiles(files);

		expect(result.imported.map((r) => r.id)).toEqual(['a', 'b']);
		expect(result.errors).toEqual([]);
	});

	it('keeps valid files and surfaces invalid ones as typed errors with the source file', async () => {
		const valid = makeFile('keep.png');
		const oversize = makeFile('big.png');
		const unsupported = makeFile('weird.svg', 'image/svg+xml');
		vi.spyOn(singleImport, 'importReferenceImage')
			.mockResolvedValueOnce({ ok: true, reference: fakeReference('keep') })
			.mockResolvedValueOnce({ ok: false, error: { kind: 'too-large' } })
			.mockResolvedValueOnce({ ok: false, error: { kind: 'unsupported-format' } });

		const result = await importReferenceFiles([valid, oversize, unsupported]);

		expect(result.imported.map((r) => r.id)).toEqual(['keep']);
		expect(result.errors).toEqual([
			{ file: oversize, error: { kind: 'too-large' } },
			{ file: unsupported, error: { kind: 'unsupported-format' } }
		]);
	});
});
