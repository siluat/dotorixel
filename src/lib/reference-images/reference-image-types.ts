export interface ReferenceImage {
	id: string;
	filename: string;
	blob: Blob;
	thumbnail: Blob;
	mimeType: string;
	naturalWidth: number;
	naturalHeight: number;
	byteSize: number;
	addedAt: Date;
}
