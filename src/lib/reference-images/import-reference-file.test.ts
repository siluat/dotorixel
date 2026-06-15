// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { importReferenceFile } from './import-reference-file';

type ImportedShape = { width: number; height: number };

function installFakeImageDecoding(shapes: ImportedShape[]) {
	const queue = shapes.slice();
	vi.stubGlobal(
		'createImageBitmap',
		vi.fn(async () => {
			const next = queue.shift();
			if (!next) throw new Error('no fake bitmap remaining');
			return {
				width: next.width,
				height: next.height,
				close: () => {}
			} as ImageBitmap;
		})
	);
	vi.stubGlobal(
		'OffscreenCanvas',
		class FakeOffscreenCanvas {
			constructor(
				public width: number,
				public height: number
			) {}
			getContext() {
				return { drawImage: () => {} };
			}
			convertToBlob() {
				return Promise.resolve(new Blob([new Uint8Array([0])], { type: 'image/png' }));
			}
		}
	);
}

function installDecodeFailure() {
	vi.stubGlobal(
		'createImageBitmap',
		vi.fn(async () => {
			throw new Error('boom');
		})
	);
}

function installMissingContext() {
	vi.stubGlobal(
		'createImageBitmap',
		vi.fn(async () => ({ width: 10, height: 10, close: () => {} }) as ImageBitmap)
	);
	vi.stubGlobal(
		'OffscreenCanvas',
		class FakeOffscreenCanvas {
			constructor(
				public width: number,
				public height: number
			) {}
			getContext() {
				return null;
			}
		}
	);
}

function makeFile(name: string, type = 'image/png', size = 1): File {
	return new File([new Uint8Array(size)], name, { type });
}

describe('importReferenceFile', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('decodes a valid file into a ReferenceImage carrying the source blob and decoded dimensions', async () => {
		installFakeImageDecoding([{ width: 120, height: 80 }]);
		const file = makeFile('a.png');

		const result = await importReferenceFile(file);

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('expected ok');
		const ref = result.reference;
		expect(ref.filename).toBe('a.png');
		expect(ref.blob).toBe(file);
		expect(ref.mimeType).toBe('image/png');
		expect(ref.naturalWidth).toBe(120);
		expect(ref.naturalHeight).toBe(80);
		expect(ref.byteSize).toBe(file.size);
		expect(ref.thumbnail).toBeInstanceOf(Blob);
		expect(typeof ref.id).toBe('string');
		expect(ref.id.length).toBeGreaterThan(0);
		expect(ref.addedAt).toBeInstanceOf(Date);
	});

	it('rejects an unsupported MIME type before touching the decoder', async () => {
		installDecodeFailure();
		const result = await importReferenceFile(makeFile('weird.svg', 'image/svg+xml'));

		expect(result).toEqual({ ok: false, error: { kind: 'unsupported-format' } });
	});

	it('rejects a file over the size limit before touching the decoder', async () => {
		installDecodeFailure();
		const result = await importReferenceFile(makeFile('big.png', 'image/png', 10 * 1024 * 1024 + 1));

		expect(result).toEqual({ ok: false, error: { kind: 'too-large' } });
	});

	it('reports decode-failed when the decoder throws', async () => {
		installDecodeFailure();
		const result = await importReferenceFile(makeFile('broken.png'));

		expect(result).toEqual({ ok: false, error: { kind: 'decode-failed' } });
	});

	it('reports decode-failed when the thumbnail 2D context is unavailable', async () => {
		installMissingContext();
		const result = await importReferenceFile(makeFile('a.png'));

		expect(result).toEqual({ ok: false, error: { kind: 'decode-failed' } });
	});
});
