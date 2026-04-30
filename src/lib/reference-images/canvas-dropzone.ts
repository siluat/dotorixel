import type { Action } from 'svelte/action';

export type CanvasDropzoneParams = {
	onFilesDropped: (files: File[], localX: number, localY: number) => void;
};

/**
 * Svelte action that turns its host element into a file drop target.
 *
 * - Sets `data-drag-over` to `"true"` while files are being dragged over the
 *   element so callers can highlight via CSS.
 * - On drop, translates `clientX/Y` into element-local coordinates and invokes
 *   the callback with the dropped `File` list.
 * - Ignores drag events that carry non-file payloads (e.g. selected text).
 *
 * Implemented as an action rather than a wrapping component so it attaches to
 * an existing layout element without introducing a `pointer-events`-blocking
 * overlay that would steal canvas drawing input.
 */
export const canvasDropzone: Action<HTMLElement, CanvasDropzoneParams> = (node, initial) => {
	let { onFilesDropped } = initial;
	let depth = 0;

	function setDragOver(value: boolean) {
		node.setAttribute('data-drag-over', value ? 'true' : 'false');
	}

	function hasFiles(event: DragEvent): boolean {
		const dt = event.dataTransfer;
		if (!dt) return false;
		if (dt.types.includes('Files')) return true;
		return Array.from(dt.items ?? []).some((item) => item.kind === 'file');
	}

	function onDragEnter(event: DragEvent) {
		if (!hasFiles(event)) return;
		event.preventDefault();
		depth += 1;
		setDragOver(depth > 0);
	}

	function onDragLeave(event: DragEvent) {
		if (!hasFiles(event)) return;
		depth = Math.max(0, depth - 1);
		setDragOver(depth > 0);
	}

	function onDragOver(event: DragEvent) {
		if (!hasFiles(event)) return;
		event.preventDefault();
	}

	function onDrop(event: DragEvent) {
		event.preventDefault();
		depth = 0;
		setDragOver(false);
		const files = Array.from(event.dataTransfer?.files ?? []);
		if (files.length === 0) return;
		const rect = node.getBoundingClientRect();
		onFilesDropped(files, event.clientX - rect.left, event.clientY - rect.top);
	}

	setDragOver(false);
	node.addEventListener('dragenter', onDragEnter);
	node.addEventListener('dragleave', onDragLeave);
	node.addEventListener('dragover', onDragOver);
	node.addEventListener('drop', onDrop);

	return {
		update(next: CanvasDropzoneParams) {
			onFilesDropped = next.onFilesDropped;
		},
		destroy() {
			node.removeEventListener('dragenter', onDragEnter);
			node.removeEventListener('dragleave', onDragLeave);
			node.removeEventListener('dragover', onDragOver);
			node.removeEventListener('drop', onDrop);
		}
	};
};
