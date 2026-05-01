import { importReferenceImage, type ImportError } from './import-reference-image';
import type { ReferenceImage } from './reference-image-types';

export type ImportFileError = {
	file: File;
	error: ImportError;
};

export type ImportFilesResult = {
	imported: ReferenceImage[];
	errors: ImportFileError[];
};

/**
 * Run a batch of files through {@link importReferenceImage} sequentially.
 *
 * Imports are returned in input order. Files that fail validation or decoding
 * are returned as typed errors paired with the source `File`, so callers can
 * format localized messages without re-deriving the source filename.
 */
export async function importReferenceFiles(files: Iterable<File>): Promise<ImportFilesResult> {
	const imported: ReferenceImage[] = [];
	const errors: ImportFileError[] = [];
	for (const file of files) {
		const result = await importReferenceImage(file);
		if (result.ok) {
			imported.push(result.reference);
		} else {
			errors.push({ file, error: result.error });
		}
	}
	return { imported, errors };
}
