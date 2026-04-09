// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushSync } from 'svelte';
import { createDrawerState } from './drawer-state.svelte';

describe('createDrawerState', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	function setup(animationMs?: number) {
		let openSignal = $state(false);
		const onClose = vi.fn();
		const onReset = vi.fn();

		let drawer!: ReturnType<typeof createDrawerState>;

		const cleanup = $effect.root(() => {
			drawer = createDrawerState({
				open: () => openSignal,
				onClose,
				onReset,
				...(animationMs !== undefined ? { animationMs } : {})
			});
		});

		function setOpen(value: boolean) {
			flushSync(() => {
				openSignal = value;
			});
		}

		return { drawer, setOpen, onClose, onReset, cleanup };
	}

	it('drawerOpen becomes true immediately when open() returns true', () => {
		const { drawer, setOpen, cleanup } = setup();

		expect(drawer.drawerOpen).toBe(false);
		setOpen(true);
		expect(drawer.drawerOpen).toBe(true);

		cleanup();
	});

	it('drawerOpen remains true during close delay, becomes false after', () => {
		const { drawer, cleanup } = setup();
		drawer.handleOpenChange(true);
		drawer.handleOpenChange(false);

		expect(drawer.drawerOpen).toBe(true);

		vi.advanceTimersByTime(499);
		expect(drawer.drawerOpen).toBe(true);

		vi.advanceTimersByTime(1);
		expect(drawer.drawerOpen).toBe(false);

		cleanup();
	});

	it('onClose fires after the delay, not immediately', () => {
		const { drawer, onClose, cleanup } = setup();
		drawer.handleOpenChange(true);
		drawer.handleOpenChange(false);

		expect(onClose).not.toHaveBeenCalled();
		vi.advanceTimersByTime(500);
		expect(onClose).toHaveBeenCalledOnce();

		cleanup();
	});

	it('onReset fires after the delay alongside onClose', () => {
		const { drawer, onReset, onClose, cleanup } = setup();
		drawer.handleOpenChange(true);
		drawer.handleOpenChange(false);

		expect(onReset).not.toHaveBeenCalled();
		vi.advanceTimersByTime(500);
		expect(onReset).toHaveBeenCalledOnce();
		expect(onClose).toHaveBeenCalledOnce();

		cleanup();
	});

	it('rapid open-close-open clears the pending close timeout', () => {
		const { drawer, onClose, cleanup } = setup();
		drawer.handleOpenChange(true);
		drawer.handleOpenChange(false);

		vi.advanceTimersByTime(200);
		drawer.handleOpenChange(true);

		vi.advanceTimersByTime(500);
		expect(onClose).not.toHaveBeenCalled();
		expect(drawer.drawerOpen).toBe(true);

		cleanup();
	});

	it('parent-initiated close is immediate without delay', () => {
		const { drawer, setOpen, onClose, onReset, cleanup } = setup();
		setOpen(true);
		expect(drawer.drawerOpen).toBe(true);

		setOpen(false);

		expect(drawer.drawerOpen).toBe(false);
		expect(onReset).toHaveBeenCalledOnce();
		expect(onClose).not.toHaveBeenCalled();

		cleanup();
	});

	it('respects custom animationMs', () => {
		const { drawer, onClose, cleanup } = setup(200);
		drawer.handleOpenChange(true);
		drawer.handleOpenChange(false);

		vi.advanceTimersByTime(199);
		expect(drawer.drawerOpen).toBe(true);

		vi.advanceTimersByTime(1);
		expect(drawer.drawerOpen).toBe(false);
		expect(onClose).toHaveBeenCalledOnce();

		cleanup();
	});
});
