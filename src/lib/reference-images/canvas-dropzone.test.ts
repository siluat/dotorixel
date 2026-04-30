// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { canvasDropzone } from './canvas-dropzone';

function fileDataTransfer(files: File[]): DataTransfer {
	const dt = new DataTransfer();
	for (const f of files) dt.items.add(f);
	return dt;
}

function dispatchDrag(
	target: Element,
	type: 'dragenter' | 'dragleave' | 'dragover' | 'drop',
	dataTransfer: DataTransfer,
	clientX = 0,
	clientY = 0
) {
	const evt = new MouseEvent(type, { clientX, clientY, bubbles: true, cancelable: true });
	Object.defineProperty(evt, 'dataTransfer', { value: dataTransfer });
	target.dispatchEvent(evt);
}

function mountZone(onFilesDropped: (files: File[], x: number, y: number) => void) {
	const node = document.createElement('div');
	document.body.appendChild(node);
	const action = canvasDropzone(node, { onFilesDropped });
	return {
		node,
		cleanup: () => {
			if (action && typeof action === 'object' && 'destroy' in action) action.destroy?.();
			node.remove();
		}
	};
}

afterEach(() => {
	document.body.innerHTML = '';
	vi.restoreAllMocks();
});

describe('canvasDropzone action', () => {
	it('translates drop clientX/Y into rect-local coordinates and forwards files', () => {
		const onFilesDropped = vi.fn();
		const { node } = mountZone(onFilesDropped);
		vi.spyOn(node, 'getBoundingClientRect').mockReturnValue({
			left: 100,
			top: 50,
			right: 0,
			bottom: 0,
			width: 0,
			height: 0,
			x: 0,
			y: 0,
			toJSON: () => ({})
		} as DOMRect);

		const file = new File([new Uint8Array([0])], 'a.png', { type: 'image/png' });
		dispatchDrag(node, 'drop', fileDataTransfer([file]), 240, 130);

		expect(onFilesDropped).toHaveBeenCalledOnce();
		const [files, x, y] = onFilesDropped.mock.calls[0];
		expect(files.map((f: File) => f.name)).toEqual(['a.png']);
		expect(x).toBe(140);
		expect(y).toBe(80);
	});

	it('marks the node as drag-over on dragenter and clears it on drop', () => {
		const { node } = mountZone(vi.fn());
		const dt = fileDataTransfer([new File([''], 'x.png', { type: 'image/png' })]);

		dispatchDrag(node, 'dragenter', dt);
		expect(node.getAttribute('data-drag-over')).toBe('true');

		dispatchDrag(node, 'drop', dt);
		expect(node.getAttribute('data-drag-over')).toBe('false');
	});

	it('clears the drag-over flag on dragleave', () => {
		const { node } = mountZone(vi.fn());
		const dt = fileDataTransfer([new File([''], 'x.png', { type: 'image/png' })]);

		dispatchDrag(node, 'dragenter', dt);
		dispatchDrag(node, 'dragleave', dt);

		expect(node.getAttribute('data-drag-over')).toBe('false');
	});

	it('ignores drag events that do not carry files', () => {
		const onFilesDropped = vi.fn();
		const { node } = mountZone(onFilesDropped);
		const dt = new DataTransfer();
		dt.setData('text/plain', 'hello');

		dispatchDrag(node, 'dragenter', dt);
		expect(node.getAttribute('data-drag-over')).toBe('false');

		dispatchDrag(node, 'drop', dt);
		expect(onFilesDropped).not.toHaveBeenCalled();
	});

	it('detaches every listener on destroy', () => {
		const onFilesDropped = vi.fn();
		const node = document.createElement('div');
		document.body.appendChild(node);
		const action = canvasDropzone(node, { onFilesDropped });

		if (action && typeof action === 'object' && 'destroy' in action) action.destroy?.();

		dispatchDrag(node, 'drop', fileDataTransfer([new File([''], 'x.png', { type: 'image/png' })]));
		expect(onFilesDropped).not.toHaveBeenCalled();
	});
});
