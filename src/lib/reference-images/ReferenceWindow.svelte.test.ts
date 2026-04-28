// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/svelte';
import ReferenceWindow from './ReferenceWindow.svelte';
import type { ReferenceImage } from './reference-image-types';

afterEach(() => {
	cleanup();
	vi.useRealTimers();
});

function mockImageRect(img: HTMLElement, width: number, height: number, left = 0, top = 0): void {
	vi.spyOn(img, 'getBoundingClientRect').mockReturnValue({
		x: left,
		y: top,
		left,
		top,
		right: left + width,
		bottom: top + height,
		width,
		height,
		toJSON() {}
	} as DOMRect);
}

function makeRef(id: string, filename = `${id}.png`): ReferenceImage {
	return {
		id,
		filename,
		blob: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }),
		thumbnail: new Blob([new Uint8Array([4, 5, 6])], { type: 'image/png' }),
		mimeType: 'image/png',
		naturalWidth: 100,
		naturalHeight: 200,
		byteSize: 3,
		addedAt: new Date('2026-04-26T00:00:00Z')
	};
}

describe('ReferenceWindow', () => {
	it('positions the window using the provided x/y/width/height', () => {
		const ref = makeRef('ref-1');

		render(ReferenceWindow, {
			reference: ref,
			x: 40,
			y: 60,
			width: 200,
			height: 300,
			isActive: true,
			onClose: vi.fn()
		});

		const win = screen.getByRole('dialog');
		expect(win.style.left).toBe('40px');
		expect(win.style.top).toBe('60px');
		expect(win.style.width).toBe('200px');
		expect(win.style.height).toBe('300px');
	});

	it('renders the reference image in the body', () => {
		const ref = makeRef('ref-1');

		render(ReferenceWindow, {
			reference: ref,
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			isActive: true,
			onClose: vi.fn()
		});

		const img = screen.getByRole('img');
		expect(img.getAttribute('src')).toMatch(/^blob:/);
	});

	it('calls onClose when the close button is clicked', async () => {
		const ref = makeRef('ref-1');
		const onClose = vi.fn();

		render(ReferenceWindow, {
			reference: ref,
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			isActive: true,
			onClose
		});

		const closeButton = screen.getByRole('button', { name: /close/i });
		await fireEvent.click(closeButton);

		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it('title-bar drag emits onMove with the new absolute position based on pointer delta', async () => {
		const ref = makeRef('ref-1');
		const onMove = vi.fn();

		render(ReferenceWindow, {
			reference: ref,
			x: 100,
			y: 100,
			width: 200,
			height: 200,
			isActive: true,
			onClose: vi.fn(),
			onMove
		});

		const titleBar = screen.getByText(ref.filename).parentElement!;
		await fireEvent.pointerDown(titleBar, { pointerId: 1, clientX: 50, clientY: 60 });
		await fireEvent.pointerMove(titleBar, { pointerId: 1, clientX: 80, clientY: 110 });

		expect(onMove).toHaveBeenCalledWith(130, 150);
	});

	it('bottom-right handle drag emits onResize with the aspect ratio preserved', async () => {
		const ref = makeRef('ref-1');
		const onResize = vi.fn();

		render(ReferenceWindow, {
			reference: ref,
			x: 0,
			y: 0,
			width: 200,
			height: 100,
			isActive: true,
			onClose: vi.fn(),
			onResize
		});

		const handle = screen.getByRole('button', { name: /resize/i });
		await fireEvent.pointerDown(handle, { pointerId: 1, clientX: 200, clientY: 100 });
		await fireEvent.pointerMove(handle, { pointerId: 1, clientX: 250, clientY: 150 });

		expect(onResize).toHaveBeenCalledWith(300, 150);
	});

	it('does not start a drag when pointerdown originates from a button inside the title bar', async () => {
		const ref = makeRef('ref-1');
		const onMove = vi.fn();
		const onMoveCommit = vi.fn();

		render(ReferenceWindow, {
			reference: ref,
			x: 100,
			y: 100,
			width: 200,
			height: 200,
			isActive: true,
			onClose: vi.fn(),
			onMove,
			onMoveCommit
		});

		const closeButton = screen.getByRole('button', { name: /close/i });
		await fireEvent.pointerDown(closeButton, { pointerId: 1, clientX: 0, clientY: 0 });
		await fireEvent.pointerMove(closeButton, { pointerId: 1, clientX: 50, clientY: 50 });
		await fireEvent.pointerUp(closeButton, { pointerId: 1, clientX: 50, clientY: 50 });

		expect(onMove).not.toHaveBeenCalled();
		expect(onMoveCommit).not.toHaveBeenCalled();
	});

	it('absorbs pointer events so a hit-test inside the window does not pass through to siblings', () => {
		const ref = makeRef('ref-1');

		render(ReferenceWindow, {
			reference: ref,
			x: 0,
			y: 0,
			width: 200,
			height: 200,
			isActive: true,
			onClose: vi.fn()
		});

		const win = screen.getByRole('dialog');
		expect(win.style.pointerEvents).toBe('auto');
	});

	it('cleans up the title-bar drag and commits when pointer capture is lost (e.g., palm rejection)', async () => {
		const ref = makeRef('ref-1');
		const onMove = vi.fn();
		const onMoveCommit = vi.fn();

		render(ReferenceWindow, {
			reference: ref,
			x: 100,
			y: 100,
			width: 200,
			height: 200,
			isActive: true,
			onClose: vi.fn(),
			onMove,
			onMoveCommit
		});

		const titleBar = screen.getByText(ref.filename).parentElement!;
		await fireEvent.pointerDown(titleBar, { pointerId: 1, clientX: 50, clientY: 60 });
		await fireEvent(titleBar, new Event('lostpointercapture'));

		expect(onMoveCommit).toHaveBeenCalledTimes(1);

		onMove.mockClear();
		await fireEvent.pointerMove(titleBar, { pointerId: 1, clientX: 200, clientY: 200 });
		expect(onMove).not.toHaveBeenCalled();
	});

	it('cleans up the resize drag and commits when pointer capture is lost', async () => {
		const ref = makeRef('ref-1');
		const onResize = vi.fn();
		const onResizeCommit = vi.fn();

		render(ReferenceWindow, {
			reference: ref,
			x: 0,
			y: 0,
			width: 200,
			height: 100,
			isActive: true,
			onClose: vi.fn(),
			onResize,
			onResizeCommit
		});

		const handle = screen.getByRole('button', { name: /resize/i });
		await fireEvent.pointerDown(handle, { pointerId: 1, clientX: 200, clientY: 100 });
		await fireEvent(handle, new Event('lostpointercapture'));

		expect(onResizeCommit).toHaveBeenCalledTimes(1);

		onResize.mockClear();
		await fireEvent.pointerMove(handle, { pointerId: 1, clientX: 400, clientY: 200 });
		expect(onResize).not.toHaveBeenCalled();
	});

	it('clicking the minimize button when expanded calls onMinimizeChange(true)', async () => {
		const ref = makeRef('ref-1');
		const onMinimizeChange = vi.fn();

		render(ReferenceWindow, {
			reference: ref,
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			isActive: true,
			minimized: false,
			onClose: vi.fn(),
			onMinimizeChange
		});

		const minimizeButton = screen.getByRole('button', { name: /minimize/i });
		await fireEvent.click(minimizeButton);

		expect(onMinimizeChange).toHaveBeenCalledWith(true);
	});

	it('clicking the restore button when minimized calls onMinimizeChange(false)', async () => {
		const ref = makeRef('ref-1');
		const onMinimizeChange = vi.fn();

		render(ReferenceWindow, {
			reference: ref,
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			isActive: true,
			minimized: true,
			onClose: vi.fn(),
			onMinimizeChange
		});

		const restoreButton = screen.getByRole('button', { name: /restore/i });
		await fireEvent.click(restoreButton);

		expect(onMinimizeChange).toHaveBeenCalledWith(false);
	});

	it('double-clicking the title bar when expanded calls onMinimizeChange(true)', async () => {
		const ref = makeRef('ref-1');
		const onMinimizeChange = vi.fn();

		render(ReferenceWindow, {
			reference: ref,
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			isActive: true,
			minimized: false,
			onClose: vi.fn(),
			onMinimizeChange
		});

		const titleBar = screen.getByText(ref.filename).parentElement!;
		await fireEvent.dblClick(titleBar);

		expect(onMinimizeChange).toHaveBeenCalledWith(true);
	});

	it('double-clicking the title bar when minimized calls onMinimizeChange(false)', async () => {
		const ref = makeRef('ref-1');
		const onMinimizeChange = vi.fn();

		render(ReferenceWindow, {
			reference: ref,
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			isActive: true,
			minimized: true,
			onClose: vi.fn(),
			onMinimizeChange
		});

		const titleBar = screen.getByText(ref.filename).parentElement!;
		await fireEvent.dblClick(titleBar);

		expect(onMinimizeChange).toHaveBeenCalledWith(false);
	});

	it('does not toggle minimize state when double-clicking title-bar buttons (closest("button") guard)', async () => {
		const ref = makeRef('ref-1');
		const onMinimizeChange = vi.fn();

		render(ReferenceWindow, {
			reference: ref,
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			isActive: true,
			minimized: false,
			onClose: vi.fn(),
			onMinimizeChange
		});

		const closeButton = screen.getByRole('button', { name: /close/i });
		await fireEvent.dblClick(closeButton);

		expect(onMinimizeChange).not.toHaveBeenCalled();
	});

	it('does not render the image body when minimized', () => {
		const ref = makeRef('ref-1');

		render(ReferenceWindow, {
			reference: ref,
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			isActive: true,
			minimized: true,
			onClose: vi.fn()
		});

		expect(screen.queryByRole('img')).toBeNull();
	});

	it('does not render the resize handle when minimized', () => {
		const ref = makeRef('ref-1');

		render(ReferenceWindow, {
			reference: ref,
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			isActive: true,
			minimized: true,
			onClose: vi.fn(),
			onResize: vi.fn()
		});

		expect(screen.queryByRole('button', { name: /resize/i })).toBeNull();
	});

	it('still allows title-bar drag to emit onMove when minimized', async () => {
		const ref = makeRef('ref-1');
		const onMove = vi.fn();

		render(ReferenceWindow, {
			reference: ref,
			x: 100,
			y: 100,
			width: 200,
			height: 200,
			isActive: true,
			minimized: true,
			onClose: vi.fn(),
			onMove
		});

		const titleBar = screen.getByText(ref.filename).parentElement!;
		await fireEvent.pointerDown(titleBar, { pointerId: 1, clientX: 50, clientY: 60 });
		await fireEvent.pointerMove(titleBar, { pointerId: 1, clientX: 80, clientY: 110 });

		expect(onMove).toHaveBeenCalledWith(130, 150);
	});

	it('mouse pointerdown on the image invokes onSamplePixelAt immediately with image-natural integer coords', async () => {
		const ref = makeRef('ref-1');
		const onSamplePixelAt = vi.fn();

		render(ReferenceWindow, {
			reference: ref,
			x: 0,
			y: 0,
			width: 200,
			height: 300,
			isActive: true,
			onClose: vi.fn(),
			onSamplePixelAt
		});

		const img = screen.getByRole('img');
		// happy-dom does not run layout, so getBoundingClientRect returns zeros.
		// Inject a deterministic rect representing the displayed image (200×300 at top-left of the viewport).
		vi.spyOn(img, 'getBoundingClientRect').mockReturnValue({
			x: 0,
			y: 0,
			left: 0,
			top: 0,
			right: 200,
			bottom: 300,
			width: 200,
			height: 300,
			toJSON() {}
		} as DOMRect);

		await fireEvent.pointerDown(img, { pointerId: 1, pointerType: 'mouse', clientX: 50, clientY: 60 });

		// natural 100×200 displayed as 200×300 → x = floor(50*100/200)=25, y = floor(60*200/300)=40.
		expect(onSamplePixelAt).toHaveBeenCalledTimes(1);
		expect(onSamplePixelAt).toHaveBeenCalledWith(25, 40);
	});

	it('does not invoke onSamplePixelAt when the prop is omitted (mouse path)', async () => {
		const ref = makeRef('ref-1');

		render(ReferenceWindow, {
			reference: ref,
			x: 0,
			y: 0,
			width: 200,
			height: 300,
			isActive: true,
			onClose: vi.fn()
		});

		const img = screen.getByRole('img');
		// No assertion on a callback — this case asserts the absence of error
		// when onSamplePixelAt is undefined. A regression that throws would fail
		// fireEvent.pointerDown.
		await fireEvent.pointerDown(img, { pointerId: 1, pointerType: 'mouse', clientX: 10, clientY: 10 });
	});

	it('touch long-press on the image fires onSampleStart with image-natural integer coords', async () => {
		vi.useFakeTimers();
		const ref = makeRef('ref-1');
		const onSampleStart = vi.fn();

		render(ReferenceWindow, {
			reference: ref,
			x: 0,
			y: 0,
			width: 200,
			height: 300,
			isActive: true,
			onClose: vi.fn(),
			onSampleStart
		});

		const img = screen.getByRole('img');
		mockImageRect(img, 200, 300);

		await fireEvent.pointerDown(img, {
			pointerId: 1,
			pointerType: 'touch',
			clientX: 50,
			clientY: 60
		});

		expect(onSampleStart).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(450);

		// natural 100×200 displayed as 200×300 → x=floor(50*100/200)=25, y=floor(60*200/300)=40.
		expect(onSampleStart).toHaveBeenCalledTimes(1);
		expect(onSampleStart).toHaveBeenCalledWith(25, 40);
	});

	it('after touch long-press fires, pointermove invokes onSampleMove with current image coords', async () => {
		vi.useFakeTimers();
		const ref = makeRef('ref-1');
		const onSampleStart = vi.fn();
		const onSampleMove = vi.fn();

		render(ReferenceWindow, {
			reference: ref,
			x: 0,
			y: 0,
			width: 200,
			height: 300,
			isActive: true,
			onClose: vi.fn(),
			onSampleStart,
			onSampleMove
		});

		const img = screen.getByRole('img');
		mockImageRect(img, 200, 300);

		await fireEvent.pointerDown(img, {
			pointerId: 1,
			pointerType: 'touch',
			clientX: 50,
			clientY: 60
		});
		await vi.advanceTimersByTimeAsync(450);
		expect(onSampleStart).toHaveBeenCalledTimes(1);

		await fireEvent.pointerMove(img, {
			pointerId: 1,
			pointerType: 'touch',
			clientX: 100,
			clientY: 150
		});

		// natural 100×200 displayed as 200×300 → x=floor(100*100/200)=50, y=floor(150*200/300)=100.
		expect(onSampleMove).toHaveBeenCalledTimes(1);
		expect(onSampleMove).toHaveBeenCalledWith(50, 100);
	});

	it('releasing after touch long-press fires onSampleEnd with the release image coords', async () => {
		vi.useFakeTimers();
		const ref = makeRef('ref-1');
		const onSampleEnd = vi.fn();

		render(ReferenceWindow, {
			reference: ref,
			x: 0,
			y: 0,
			width: 200,
			height: 300,
			isActive: true,
			onClose: vi.fn(),
			onSampleStart: vi.fn(),
			onSampleMove: vi.fn(),
			onSampleEnd
		});

		const img = screen.getByRole('img');
		mockImageRect(img, 200, 300);

		await fireEvent.pointerDown(img, {
			pointerId: 1,
			pointerType: 'touch',
			clientX: 50,
			clientY: 60
		});
		await vi.advanceTimersByTimeAsync(450);

		await fireEvent.pointerMove(img, {
			pointerId: 1,
			pointerType: 'touch',
			clientX: 80,
			clientY: 90
		});
		await fireEvent.pointerUp(img, {
			pointerId: 1,
			pointerType: 'touch',
			clientX: 80,
			clientY: 90
		});

		// natural 100×200 displayed as 200×300 → x=floor(80*100/200)=40, y=floor(90*200/300)=60.
		expect(onSampleEnd).toHaveBeenCalledTimes(1);
		expect(onSampleEnd).toHaveBeenCalledWith(40, 60);
	});

	it('short touch tap (release before threshold) invokes onSamplePixelAt and not the long-press callbacks', async () => {
		vi.useFakeTimers();
		const ref = makeRef('ref-1');
		const onSamplePixelAt = vi.fn();
		const onSampleStart = vi.fn();
		const onSampleEnd = vi.fn();

		render(ReferenceWindow, {
			reference: ref,
			x: 0,
			y: 0,
			width: 200,
			height: 300,
			isActive: true,
			onClose: vi.fn(),
			onSamplePixelAt,
			onSampleStart,
			onSampleEnd
		});

		const img = screen.getByRole('img');
		mockImageRect(img, 200, 300);

		await fireEvent.pointerDown(img, {
			pointerId: 1,
			pointerType: 'touch',
			clientX: 50,
			clientY: 60
		});
		await vi.advanceTimersByTimeAsync(100);
		await fireEvent.pointerUp(img, {
			pointerId: 1,
			pointerType: 'touch',
			clientX: 50,
			clientY: 60
		});

		expect(onSampleStart).not.toHaveBeenCalled();
		expect(onSampleEnd).not.toHaveBeenCalled();
		expect(onSamplePixelAt).toHaveBeenCalledTimes(1);
		expect(onSamplePixelAt).toHaveBeenCalledWith(25, 40);
	});

	it('pen long-press behaves like touch (fires onSampleStart after threshold)', async () => {
		vi.useFakeTimers();
		const ref = makeRef('ref-1');
		const onSampleStart = vi.fn();

		render(ReferenceWindow, {
			reference: ref,
			x: 0,
			y: 0,
			width: 200,
			height: 300,
			isActive: true,
			onClose: vi.fn(),
			onSampleStart
		});

		const img = screen.getByRole('img');
		mockImageRect(img, 200, 300);

		await fireEvent.pointerDown(img, {
			pointerId: 1,
			pointerType: 'pen',
			clientX: 50,
			clientY: 60
		});
		await vi.advanceTimersByTimeAsync(450);

		expect(onSampleStart).toHaveBeenCalledTimes(1);
		expect(onSampleStart).toHaveBeenCalledWith(25, 40);
	});

	it('pointercancel after fire still emits onSampleEnd (commit-on-leave semantics)', async () => {
		vi.useFakeTimers();
		const ref = makeRef('ref-1');
		const onSampleEnd = vi.fn();

		render(ReferenceWindow, {
			reference: ref,
			x: 0,
			y: 0,
			width: 200,
			height: 300,
			isActive: true,
			onClose: vi.fn(),
			onSampleStart: vi.fn(),
			onSampleEnd
		});

		const img = screen.getByRole('img');
		mockImageRect(img, 200, 300);

		await fireEvent.pointerDown(img, {
			pointerId: 1,
			pointerType: 'touch',
			clientX: 50,
			clientY: 60
		});
		await vi.advanceTimersByTimeAsync(450);
		await fireEvent.pointerCancel(img, {
			pointerId: 1,
			pointerType: 'touch',
			clientX: 50,
			clientY: 60
		});

		expect(onSampleEnd).toHaveBeenCalledTimes(1);
		expect(onSampleEnd).toHaveBeenCalledWith(25, 40);
	});

	it('marks itself active or inactive via data attribute for styling', () => {
		const ref = makeRef('ref-1');

		const { rerender } = render(ReferenceWindow, {
			reference: ref,
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			isActive: true,
			onClose: vi.fn()
		});

		const win = screen.getByRole('dialog');
		expect(win.getAttribute('data-active')).toBe('true');

		rerender({
			reference: ref,
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			isActive: false,
			onClose: vi.fn()
		});

		expect(win.getAttribute('data-active')).toBe('false');
	});
});
