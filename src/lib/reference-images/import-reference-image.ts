import { validateFile, type ValidationResult } from './import-validator';
import { computeThumbnailDimensions } from './thumbnail';
import type { ReferenceImage } from './reference-image-types';

const THUMBNAIL_LONGEST_EDGE = 256;

export type ImportError =
	| { kind: 'unsupported-format' }
	| { kind: 'too-large' }
	| { kind: 'decode-failed' };

export type ImportResult =
	| { ok: true; reference: ReferenceImage }
	| { ok: false; error: ImportError };

export async function importReferenceImage(file: File): Promise<ImportResult> {
	const validation: ValidationResult = validateFile({ type: file.type, size: file.size });
	if (!validation.ok) {
		return { ok: false, error: { kind: validation.reason } };
	}

	let bitmap: ImageBitmap;
	try {
		bitmap = await createImageBitmap(file);
	} catch {
		return { ok: false, error: { kind: 'decode-failed' } };
	}

	const naturalWidth = bitmap.width;
	const naturalHeight = bitmap.height;
	const { w, h } = computeThumbnailDimensions(naturalWidth, naturalHeight, THUMBNAIL_LONGEST_EDGE);

	let thumbnail: Blob;
	try {
		const offscreen = new OffscreenCanvas(w, h);
		const ctx = offscreen.getContext('2d');
		if (!ctx) {
			bitmap.close();
			return { ok: false, error: { kind: 'decode-failed' } };
		}
		ctx.drawImage(bitmap, 0, 0, w, h);
		thumbnail = await offscreen.convertToBlob({ type: 'image/png' });
	} catch {
		bitmap.close();
		return { ok: false, error: { kind: 'decode-failed' } };
	}
	bitmap.close();

	return {
		ok: true,
		reference: {
			id: crypto.randomUUID(),
			filename: file.name,
			blob: file,
			thumbnail,
			mimeType: file.type,
			naturalWidth,
			naturalHeight,
			byteSize: file.size,
			addedAt: new Date()
		}
	};
}
