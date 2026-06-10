// @vitest-environment happy-dom
import type { ComponentProps } from 'svelte';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/svelte';
import ReferenceWindow from './ReferenceWindow.svelte';
import type { ReferenceImage } from './reference-image-types';

afterEach(() => {
	cleanup();
	vi.useRealTimers();
});

type WindowProps = ComponentProps<typeof ReferenceWindow>;

function renderWindow(overrides: Partial<WindowProps>) {
	return render(ReferenceWindow, { ...overrides } as WindowProps);
}

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

		renderWindow({
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

		renderWindow({
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

	it('marks the reference image as non-draggable so HTML5 drag does not hijack mouse sampling', () => {
		const ref = makeRef('ref-1');

		renderWindow({
			reference: ref,
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			isActive: true,
			onClose: vi.fn()
		});

		const img = screen.getByRole('img');
		expect(img.getAttribute('draggable')).toBe('false');
	});

	it('calls onClose when the close button is clicked', async () => {
		const ref = makeRef('ref-1');
		const onClose = vi.fn();

		renderWindow({
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

	it('title-bar drag emits onMoveStart then onMoveDelta with the raw pointer delta', async () => {
		const ref = makeRef('ref-1');
		const onMoveStart = vi.fn();
		const onMoveDelta = vi.fn();

		renderWindow({
			reference: ref,
			x: 100,
			y: 100,
			width: 200,
			height: 200,
			isActive: true,
			onClose: vi.fn(),
			onMoveStart,
			onMoveDelta
		});

		const titleBar = screen.getByText(ref.filename).parentElement!;
		await fireEvent.pointerDown(titleBar, { pointerId: 1, clientX: 50, clientY: 60 });
		await fireEvent.pointerMove(titleBar, { pointerId: 1, clientX: 80, clientY: 110 });

		expect(onMoveStart).toHaveBeenCalledTimes(1);
		// Raw pointer delta — the store owns start geometry, clamping, and snap.
		expect(onMoveDelta).toHaveBeenLastCalledWith(30, 50);
	});

	it('bottom-right handle drag emits onResizeStart then onResizeDelta with the raw pointer delta', async () => {
		const ref = makeRef('ref-1');
		const onResizeStart = vi.fn();
		const onResizeDelta = vi.fn();

		renderWindow({
			reference: ref,
			x: 0,
			y: 0,
			width: 200,
			height: 100,
			isActive: true,
			onClose: vi.fn(),
			onResizeStart,
			onResizeDelta
		});

		const handle = screen.getByRole('button', { name: /resize/i });
		await fireEvent.pointerDown(handle, { pointerId: 1, clientX: 200, clientY: 100 });
		await fireEvent.pointerMove(handle, { pointerId: 1, clientX: 250, clientY: 150 });

		expect(onResizeStart).toHaveBeenCalledTimes(1);
		// Raw pointer delta — aspect lock and viewport clamp are the store's job.
		expect(onResizeDelta).toHaveBeenLastCalledWith(50, 50);
	});

	it('does not start a drag when pointerdown originates from a button inside the title bar', async () => {
		const ref = makeRef('ref-1');
		const onMoveStart = vi.fn();
		const onMoveDelta = vi.fn();
		const onMoveEnd = vi.fn();

		renderWindow({
			reference: ref,
			x: 100,
			y: 100,
			width: 200,
			height: 200,
			isActive: true,
			onClose: vi.fn(),
			onMoveStart,
			onMoveDelta,
			onMoveEnd
		});

		const closeButton = screen.getByRole('button', { name: /close/i });
		await fireEvent.pointerDown(closeButton, { pointerId: 1, clientX: 0, clientY: 0 });
		await fireEvent.pointerMove(closeButton, { pointerId: 1, clientX: 50, clientY: 50 });
		await fireEvent.pointerUp(closeButton, { pointerId: 1, clientX: 50, clientY: 50 });

		expect(onMoveStart).not.toHaveBeenCalled();
		expect(onMoveDelta).not.toHaveBeenCalled();
		expect(onMoveEnd).not.toHaveBeenCalled();
	});

	it('absorbs pointer events so a hit-test inside the window does not pass through to siblings', () => {
		const ref = makeRef('ref-1');

		renderWindow({
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

	it('cleans up the title-bar drag and ends it when pointer capture is lost (e.g., palm rejection)', async () => {
		const ref = makeRef('ref-1');
		const onMoveDelta = vi.fn();
		const onMoveEnd = vi.fn();

		renderWindow({
			reference: ref,
			x: 100,
			y: 100,
			width: 200,
			height: 200,
			isActive: true,
			onClose: vi.fn(),
			onMoveDelta,
			onMoveEnd
		});

		const titleBar = screen.getByText(ref.filename).parentElement!;
		await fireEvent.pointerDown(titleBar, { pointerId: 1, clientX: 50, clientY: 60 });
		await fireEvent(titleBar, new Event('lostpointercapture'));

		expect(onMoveEnd).toHaveBeenCalledTimes(1);

		onMoveDelta.mockClear();
		await fireEvent.pointerMove(titleBar, { pointerId: 1, clientX: 200, clientY: 200 });
		expect(onMoveDelta).not.toHaveBeenCalled();
	});

	it('cleans up the resize drag and ends it when pointer capture is lost', async () => {
		const ref = makeRef('ref-1');
		const onResizeDelta = vi.fn();
		const onResizeEnd = vi.fn();

		renderWindow({
			reference: ref,
			x: 0,
			y: 0,
			width: 200,
			height: 100,
			isActive: true,
			onClose: vi.fn(),
			onResizeDelta,
			onResizeEnd
		});

		const handle = screen.getByRole('button', { name: /resize/i });
		await fireEvent.pointerDown(handle, { pointerId: 1, clientX: 200, clientY: 100 });
		await fireEvent(handle, new Event('lostpointercapture'));

		expect(onResizeEnd).toHaveBeenCalledTimes(1);

		onResizeDelta.mockClear();
		await fireEvent.pointerMove(handle, { pointerId: 1, clientX: 400, clientY: 200 });
		expect(onResizeDelta).not.toHaveBeenCalled();
	});

	it('clicking the minimize button when expanded calls onMinimizeChange(true)', async () => {
		const ref = makeRef('ref-1');
		const onMinimizeChange = vi.fn();

		renderWindow({
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

		renderWindow({
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

		renderWindow({
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

		renderWindow({
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

		renderWindow({
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

		renderWindow({
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

		renderWindow({
			reference: ref,
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			isActive: true,
			minimized: true,
			onClose: vi.fn(),
			onResizeDelta: vi.fn()
		});

		expect(screen.queryByRole('button', { name: /resize/i })).toBeNull();
	});

	it('still allows title-bar drag to emit onMoveDelta when minimized', async () => {
		const ref = makeRef('ref-1');
		const onMoveDelta = vi.fn();

		renderWindow({
			reference: ref,
			x: 100,
			y: 100,
			width: 200,
			height: 200,
			isActive: true,
			minimized: true,
			onClose: vi.fn(),
			onMoveDelta
		});

		const titleBar = screen.getByText(ref.filename).parentElement!;
		await fireEvent.pointerDown(titleBar, { pointerId: 1, clientX: 50, clientY: 60 });
		await fireEvent.pointerMove(titleBar, { pointerId: 1, clientX: 80, clientY: 110 });

		expect(onMoveDelta).toHaveBeenLastCalledWith(30, 50);
	});

	it('mouse pointerdown when quickSamplingEnabled fires onSampleStart with mouse inputSource', async () => {
		const ref = makeRef('ref-1');
		const onSampleStart = vi.fn();

		renderWindow({
			reference: ref,
			x: 0,
			y: 0,
			width: 200,
			height: 300,
			isActive: true,
			onClose: vi.fn(),
			quickSamplingEnabled: true,
			onSampleStart
		});

		const img = screen.getByRole('img');
		mockImageRect(img, 200, 300);

		await fireEvent.pointerDown(img, {
			pointerId: 1,
			pointerType: 'mouse',
			clientX: 50,
			clientY: 60
		});

		// natural 100×200 displayed as 200×300 → x = floor(50*100/200)=25, y = floor(60*200/300)=40.
		expect(onSampleStart).toHaveBeenCalledTimes(1);
		expect(onSampleStart).toHaveBeenCalledWith(25, 40, 'mouse');
	});

	it('mouse pointerdown when quickSamplingEnabled is false is a no-op', async () => {
		const ref = makeRef('ref-1');
		const onSampleStart = vi.fn();
		const onSampleMove = vi.fn();
		const onSampleEnd = vi.fn();

		renderWindow({
			reference: ref,
			x: 0,
			y: 0,
			width: 200,
			height: 300,
			isActive: true,
			onClose: vi.fn(),
			quickSamplingEnabled: false,
			onSampleStart,
			onSampleMove,
			onSampleEnd
		});

		const img = screen.getByRole('img');
		mockImageRect(img, 200, 300);

		await fireEvent.pointerDown(img, {
			pointerId: 1,
			pointerType: 'mouse',
			clientX: 50,
			clientY: 60
		});
		await fireEvent.pointerMove(img, {
			pointerId: 1,
			pointerType: 'mouse',
			clientX: 80,
			clientY: 90
		});
		await fireEvent.pointerUp(img, {
			pointerId: 1,
			pointerType: 'mouse',
			clientX: 80,
			clientY: 90
		});

		expect(onSampleStart).not.toHaveBeenCalled();
		expect(onSampleMove).not.toHaveBeenCalled();
		expect(onSampleEnd).not.toHaveBeenCalled();
	});

	it('mouse pointermove during an active sample invokes onSampleMove with image coords', async () => {
		const ref = makeRef('ref-1');
		const onSampleStart = vi.fn();
		const onSampleMove = vi.fn();

		renderWindow({
			reference: ref,
			x: 0,
			y: 0,
			width: 200,
			height: 300,
			isActive: true,
			onClose: vi.fn(),
			quickSamplingEnabled: true,
			onSampleStart,
			onSampleMove
		});

		const img = screen.getByRole('img');
		mockImageRect(img, 200, 300);

		await fireEvent.pointerDown(img, {
			pointerId: 1,
			pointerType: 'mouse',
			clientX: 50,
			clientY: 60
		});
		await fireEvent.pointerMove(img, {
			pointerId: 1,
			pointerType: 'mouse',
			clientX: 100,
			clientY: 150
		});

		expect(onSampleMove).toHaveBeenCalledTimes(1);
		expect(onSampleMove).toHaveBeenCalledWith(50, 100);
	});

	it('mouse pointerup ends an active sample with onSampleEnd at the release coords', async () => {
		const ref = makeRef('ref-1');
		const onSampleStart = vi.fn();
		const onSampleEnd = vi.fn();

		renderWindow({
			reference: ref,
			x: 0,
			y: 0,
			width: 200,
			height: 300,
			isActive: true,
			onClose: vi.fn(),
			quickSamplingEnabled: true,
			onSampleStart,
			onSampleEnd
		});

		const img = screen.getByRole('img');
		mockImageRect(img, 200, 300);

		await fireEvent.pointerDown(img, {
			pointerId: 1,
			pointerType: 'mouse',
			clientX: 50,
			clientY: 60
		});
		await fireEvent.pointerUp(img, {
			pointerId: 1,
			pointerType: 'mouse',
			clientX: 80,
			clientY: 90
		});

		expect(onSampleEnd).toHaveBeenCalledTimes(1);
		expect(onSampleEnd).toHaveBeenCalledWith(40, 60);
	});

	it('a single mouse click (down + up at the same point) fires both onSampleStart and onSampleEnd', async () => {
		const ref = makeRef('ref-1');
		const onSampleStart = vi.fn();
		const onSampleEnd = vi.fn();

		renderWindow({
			reference: ref,
			x: 0,
			y: 0,
			width: 200,
			height: 300,
			isActive: true,
			onClose: vi.fn(),
			quickSamplingEnabled: true,
			onSampleStart,
			onSampleEnd
		});

		const img = screen.getByRole('img');
		mockImageRect(img, 200, 300);

		await fireEvent.pointerDown(img, {
			pointerId: 1,
			pointerType: 'mouse',
			clientX: 50,
			clientY: 60
		});
		await fireEvent.pointerUp(img, {
			pointerId: 1,
			pointerType: 'mouse',
			clientX: 50,
			clientY: 60
		});

		expect(onSampleStart).toHaveBeenCalledTimes(1);
		expect(onSampleStart).toHaveBeenCalledWith(25, 40, 'mouse');
		expect(onSampleEnd).toHaveBeenCalledTimes(1);
		expect(onSampleEnd).toHaveBeenCalledWith(25, 40);
	});

	it('touch long-press on the image fires onSampleStart with image-natural integer coords', async () => {
		vi.useFakeTimers();
		const ref = makeRef('ref-1');
		const onSampleStart = vi.fn();

		renderWindow({
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
		expect(onSampleStart).toHaveBeenCalledWith(25, 40, 'touch');
	});

	it('after touch long-press fires, pointermove invokes onSampleMove with current image coords', async () => {
		vi.useFakeTimers();
		const ref = makeRef('ref-1');
		const onSampleStart = vi.fn();
		const onSampleMove = vi.fn();

		renderWindow({
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

		renderWindow({
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

	it('short touch tap with quickSamplingEnabled routes through the sampling lifecycle (start + end)', async () => {
		vi.useFakeTimers();
		const ref = makeRef('ref-1');
		const onSampleStart = vi.fn();
		const onSampleEnd = vi.fn();

		renderWindow({
			reference: ref,
			x: 0,
			y: 0,
			width: 200,
			height: 300,
			isActive: true,
			onClose: vi.fn(),
			quickSamplingEnabled: true,
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

		expect(onSampleStart).toHaveBeenCalledTimes(1);
		expect(onSampleStart).toHaveBeenCalledWith(25, 40, 'touch');
		expect(onSampleEnd).toHaveBeenCalledTimes(1);
		expect(onSampleEnd).toHaveBeenCalledWith(25, 40);
	});

	it('short touch tap with quickSamplingEnabled=false does not invoke any sampling callbacks', async () => {
		vi.useFakeTimers();
		const ref = makeRef('ref-1');
		const onSampleStart = vi.fn();
		const onSampleEnd = vi.fn();

		renderWindow({
			reference: ref,
			x: 0,
			y: 0,
			width: 200,
			height: 300,
			isActive: true,
			onClose: vi.fn(),
			quickSamplingEnabled: false,
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
	});

	it('pen long-press behaves like touch (fires onSampleStart after threshold)', async () => {
		vi.useFakeTimers();
		const ref = makeRef('ref-1');
		const onSampleStart = vi.fn();

		renderWindow({
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
		expect(onSampleStart).toHaveBeenCalledWith(25, 40, 'touch');
	});

	it('pre-fire pointercancel does not commit a color sample (system cancellation is not a tap)', async () => {
		vi.useFakeTimers();
		const ref = makeRef('ref-1');
		const onSampleStart = vi.fn();
		const onSampleEnd = vi.fn();

		renderWindow({
			reference: ref,
			x: 0,
			y: 0,
			width: 200,
			height: 300,
			isActive: true,
			onClose: vi.fn(),
			quickSamplingEnabled: true,
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
		// System cancellation before the long-press threshold.
		await vi.advanceTimersByTimeAsync(100);
		await fireEvent.pointerCancel(img, {
			pointerId: 1,
			pointerType: 'touch',
			clientX: 50,
			clientY: 60
		});

		expect(onSampleStart).not.toHaveBeenCalled();
		expect(onSampleEnd).not.toHaveBeenCalled();
	});

	it('a second long-press after a successful first one still fires onSampleStart (pendingTapCoords cleared on end)', async () => {
		vi.useFakeTimers();
		const ref = makeRef('ref-1');
		const onSampleStart = vi.fn();
		const onSampleEnd = vi.fn();

		renderWindow({
			reference: ref,
			x: 0,
			y: 0,
			width: 200,
			height: 300,
			isActive: true,
			onClose: vi.fn(),
			onSampleStart,
			onSampleEnd
		});

		const img = screen.getByRole('img');
		mockImageRect(img, 200, 300);

		// First long-press: down, hold past threshold, release.
		await fireEvent.pointerDown(img, {
			pointerId: 1,
			pointerType: 'touch',
			clientX: 50,
			clientY: 60
		});
		await vi.advanceTimersByTimeAsync(450);
		await fireEvent.pointerUp(img, {
			pointerId: 1,
			pointerType: 'touch',
			clientX: 50,
			clientY: 60
		});

		expect(onSampleStart).toHaveBeenCalledTimes(1);
		expect(onSampleEnd).toHaveBeenCalledTimes(1);

		// Second long-press must not be dropped by a stale pendingTapCoords.
		await fireEvent.pointerDown(img, {
			pointerId: 2,
			pointerType: 'touch',
			clientX: 100,
			clientY: 150
		});
		await vi.advanceTimersByTimeAsync(450);

		expect(onSampleStart).toHaveBeenCalledTimes(2);
	});

	it('a simultaneous second touch does not overwrite the first finger\'s pending tap coords', async () => {
		vi.useFakeTimers();
		const ref = makeRef('ref-1');
		const onSampleStart = vi.fn();
		const onSampleEnd = vi.fn();

		renderWindow({
			reference: ref,
			x: 0,
			y: 0,
			width: 200,
			height: 300,
			isActive: true,
			onClose: vi.fn(),
			quickSamplingEnabled: true,
			onSampleStart,
			onSampleEnd
		});

		const img = screen.getByRole('img');
		mockImageRect(img, 200, 300);

		// First finger lands at (50, 60) — natural coords (25, 40).
		await fireEvent.pointerDown(img, {
			pointerId: 1,
			pointerType: 'touch',
			clientX: 50,
			clientY: 60
		});
		// Second finger lands at (100, 150) before the threshold — must be ignored.
		await fireEvent.pointerDown(img, {
			pointerId: 2,
			pointerType: 'touch',
			clientX: 100,
			clientY: 150
		});
		// First finger lifts before the long-press threshold.
		await vi.advanceTimersByTimeAsync(100);
		await fireEvent.pointerUp(img, {
			pointerId: 1,
			pointerType: 'touch',
			clientX: 50,
			clientY: 60
		});

		// Short tap routes through the lifecycle with the first finger's coords.
		expect(onSampleStart).toHaveBeenCalledTimes(1);
		expect(onSampleStart).toHaveBeenCalledWith(25, 40, 'touch');
		expect(onSampleEnd).toHaveBeenCalledTimes(1);
		expect(onSampleEnd).toHaveBeenCalledWith(25, 40);
	});

	it('pointercancel after fire still emits onSampleEnd (commit-on-leave semantics)', async () => {
		vi.useFakeTimers();
		const ref = makeRef('ref-1');
		const onSampleEnd = vi.fn();

		renderWindow({
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

		const { rerender } = renderWindow({
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
