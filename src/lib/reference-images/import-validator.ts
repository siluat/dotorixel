export type ValidationResult =
	| { ok: true }
	| { ok: false; reason: 'unsupported-format' | 'too-large' };

const ALLOWED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export function validateFile(input: { type: string; size: number }): ValidationResult {
	if (!ALLOWED_MIME_TYPES.has(input.type)) {
		return { ok: false, reason: 'unsupported-format' };
	}
	if (input.size > MAX_FILE_SIZE_BYTES) {
		return { ok: false, reason: 'too-large' };
	}
	return { ok: true };
}
