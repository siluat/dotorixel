// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { createKeyboardInput, type KeyboardInputHost } from './keyboard-input.svelte';
import type { ToolType } from './tool-registry';

function createHost(overrides?: Partial<KeyboardInputHost>): KeyboardInputHost {
	return {
		isDrawing: vi.fn(() => false),
		getActiveTool: vi.fn(() => 'pencil' as const),
		setActiveTool: vi.fn(),
		undo: vi.fn(),
		redo: vi.fn(),
		toggleGrid: vi.fn(),
		swapColors: vi.fn(),
		notifyModifierChange: vi.fn(),
		...overrides
	};
}

function keyDown(
	code: string,
	options: {
		key?: string;
		ctrlKey?: boolean;
		metaKey?: boolean;
		altKey?: boolean;
		shiftKey?: boolean;
		repeat?: boolean;
		target?: EventTarget | null;
	} = {}
): KeyboardEvent {
	return {
		code,
		key: options.key ?? '',
		ctrlKey: options.ctrlKey ?? false,
		metaKey: options.metaKey ?? false,
		altKey: options.altKey ?? false,
		shiftKey: options.shiftKey ?? false,
		repeat: options.repeat ?? false,
		target: options.target ?? null,
		preventDefault: vi.fn()
	} as unknown as KeyboardEvent;
}

function keyUp(code: string): KeyboardEvent {
	return {
		code,
		key: '',
		ctrlKey: false,
		metaKey: false,
		altKey: false,
		shiftKey: false,
		repeat: false,
		target: null,
		preventDefault: vi.fn()
	} as unknown as KeyboardEvent;
}

// ── Space modifier ───────────────────────────────────────────

describe('Space modifier', () => {
	it('sets isSpaceHeld on press, clears on release', () => {
		const kb = createKeyboardInput(createHost());
		expect(kb.isSpaceHeld).toBe(false);

		kb.handleKeyDown(keyDown('Space'));
		expect(kb.isSpaceHeld).toBe(true);

		kb.handleKeyUp(keyUp('Space'));
		expect(kb.isSpaceHeld).toBe(false);
	});

	it('ignores repeat events', () => {
		const kb = createKeyboardInput(createHost());
		kb.handleKeyDown(keyDown('Space'));
		expect(kb.isSpaceHeld).toBe(true);

		kb.handleKeyDown(keyDown('Space', { repeat: true }));
		expect(kb.isSpaceHeld).toBe(true);
	});

	it('ignores Space when drawing', () => {
		const host = createHost({ isDrawing: vi.fn(() => true) });
		const kb = createKeyboardInput(host);

		kb.handleKeyDown(keyDown('Space'));
		expect(kb.isSpaceHeld).toBe(false);
	});

	it('resets on blur', () => {
		const kb = createKeyboardInput(createHost());
		kb.handleKeyDown(keyDown('Space'));
		expect(kb.isSpaceHeld).toBe(true);

		kb.handleBlur();
		expect(kb.isSpaceHeld).toBe(false);
	});

	it('calls preventDefault', () => {
		const kb = createKeyboardInput(createHost());
		const event = keyDown('Space');
		kb.handleKeyDown(event);
		expect(event.preventDefault).toHaveBeenCalled();
	});
});

// ── Shift modifier ───────────────────────────────────────────

describe('Shift modifier', () => {
	it('sets isShiftHeld on press, clears on release', () => {
		const kb = createKeyboardInput(createHost());
		expect(kb.isShiftHeld).toBe(false);

		kb.handleKeyDown(keyDown('ShiftLeft'));
		expect(kb.isShiftHeld).toBe(true);

		kb.handleKeyUp(keyUp('ShiftLeft'));
		expect(kb.isShiftHeld).toBe(false);
	});

	it('works with ShiftRight', () => {
		const kb = createKeyboardInput(createHost());
		kb.handleKeyDown(keyDown('ShiftRight'));
		expect(kb.isShiftHeld).toBe(true);

		kb.handleKeyUp(keyUp('ShiftRight'));
		expect(kb.isShiftHeld).toBe(false);
	});

	it('ignores repeat events', () => {
		const kb = createKeyboardInput(createHost());
		kb.handleKeyDown(keyDown('ShiftLeft'));
		kb.handleKeyDown(keyDown('ShiftLeft', { repeat: true }));
		expect(kb.isShiftHeld).toBe(true);
	});

	it('resets on blur', () => {
		const kb = createKeyboardInput(createHost());
		kb.handleKeyDown(keyDown('ShiftLeft'));
		kb.handleBlur();
		expect(kb.isShiftHeld).toBe(false);
	});
});

// ── Shortcut hints (/ key) ───────────────────────────────────

describe('shortcut hints (/ key)', () => {
	it('sets isShortcutHintsVisible on press, clears on release', () => {
		const kb = createKeyboardInput(createHost());
		expect(kb.isShortcutHintsVisible).toBe(false);

		kb.handleKeyDown(keyDown('Slash'));
		expect(kb.isShortcutHintsVisible).toBe(true);

		kb.handleKeyUp(keyUp('Slash'));
		expect(kb.isShortcutHintsVisible).toBe(false);
	});

	it('ignores repeat events', () => {
		const kb = createKeyboardInput(createHost());
		kb.handleKeyDown(keyDown('Slash'));
		kb.handleKeyDown(keyDown('Slash', { repeat: true }));
		expect(kb.isShortcutHintsVisible).toBe(true);
	});

	it('does not show hints while drawing', () => {
		const host = createHost({ isDrawing: vi.fn(() => true) });
		const kb = createKeyboardInput(host);

		kb.handleKeyDown(keyDown('Slash'));
		expect(kb.isShortcutHintsVisible).toBe(false);
	});

	it('resets on blur', () => {
		const kb = createKeyboardInput(createHost());
		kb.handleKeyDown(keyDown('Slash'));
		kb.handleBlur();
		expect(kb.isShortcutHintsVisible).toBe(false);
	});

	it('calls preventDefault', () => {
		const kb = createKeyboardInput(createHost());
		const event = keyDown('Slash');
		kb.handleKeyDown(event);
		expect(event.preventDefault).toHaveBeenCalled();
	});
});

// ── Text input filtering ─────────────────────────────────────

describe('text input filtering', () => {
	it('blocks shortcuts when an input is focused', () => {
		const host = createHost();
		const kb = createKeyboardInput(host);

		const input = document.createElement('input');
		document.body.appendChild(input);
		kb.handleKeyDown(keyDown('Space', { target: input }));
		expect(kb.isSpaceHeld).toBe(false);
		document.body.removeChild(input);
	});

	it('blocks shortcuts when a textarea is focused', () => {
		const host = createHost();
		const kb = createKeyboardInput(host);

		const textarea = document.createElement('textarea');
		document.body.appendChild(textarea);
		kb.handleKeyDown(keyDown('Space', { target: textarea }));
		expect(kb.isSpaceHeld).toBe(false);
		document.body.removeChild(textarea);
	});

	it('blocks shortcuts when a contenteditable element is focused', () => {
		const host = createHost();
		const kb = createKeyboardInput(host);

		const div = document.createElement('div');
		div.setAttribute('contenteditable', 'true');
		document.body.appendChild(div);
		kb.handleKeyDown(keyDown('Space', { target: div }));
		expect(kb.isSpaceHeld).toBe(false);
		document.body.removeChild(div);
	});

	it('allows shortcuts when a button is focused', () => {
		const host = createHost();
		const kb = createKeyboardInput(host);

		const button = document.createElement('button');
		document.body.appendChild(button);
		kb.handleKeyDown(keyDown('Space', { target: button }));
		expect(kb.isSpaceHeld).toBe(true);
		document.body.removeChild(button);
	});
});

// ── Tool shortcuts ───────────────────────────────────────────

describe('tool shortcuts', () => {
	it('switches tools via shortcut keys', () => {
		const host = createHost();
		const kb = createKeyboardInput(host);
		const mappings: [string, string][] = [
			['KeyP', 'pencil'],
			['KeyE', 'eraser'],
			['KeyL', 'line'],
			['KeyU', 'rectangle'],
			['KeyO', 'ellipse'],
			['KeyF', 'floodfill'],
			['KeyI', 'eyedropper'],
			['KeyV', 'move']
		];
		for (const [code, tool] of mappings) {
			kb.handleKeyDown(keyDown(code));
			expect(host.setActiveTool).toHaveBeenCalledWith(tool);
		}
	});

	it('works regardless of IME input language (matches by code, not key)', () => {
		const host = createHost();
		const kb = createKeyboardInput(host);
		kb.handleKeyDown(keyDown('KeyE', { key: 'ㄷ' }));
		expect(host.setActiveTool).toHaveBeenCalledWith('eraser');
	});

	it('ignores tool shortcuts while drawing', () => {
		const host = createHost({ isDrawing: vi.fn(() => true) });
		const kb = createKeyboardInput(host);

		kb.handleKeyDown(keyDown('KeyE'));
		expect(host.setActiveTool).not.toHaveBeenCalled();
	});

	it('ignores shortcuts when Ctrl is held', () => {
		const host = createHost();
		const kb = createKeyboardInput(host);
		kb.handleKeyDown(keyDown('KeyE', { ctrlKey: true }));
		expect(host.setActiveTool).not.toHaveBeenCalled();
	});

	it('ignores shortcuts when Meta is held', () => {
		const host = createHost();
		const kb = createKeyboardInput(host);
		kb.handleKeyDown(keyDown('KeyE', { metaKey: true }));
		expect(host.setActiveTool).not.toHaveBeenCalled();
	});

	it('ignores shortcuts when Alt is held', () => {
		const host = createHost();
		const kb = createKeyboardInput(host);
		kb.handleKeyDown(keyDown('KeyE', { altKey: true }));
		expect(host.setActiveTool).not.toHaveBeenCalled();
	});

	it('ignores shortcuts when Shift is held', () => {
		const host = createHost();
		const kb = createKeyboardInput(host);
		kb.handleKeyDown(keyDown('KeyE', { shiftKey: true }));
		expect(host.setActiveTool).not.toHaveBeenCalled();
	});
});

// ── Grid toggle ──────────────────────────────────────────────

describe('grid toggle (G key)', () => {
	it('calls toggleGrid', () => {
		const host = createHost();
		const kb = createKeyboardInput(host);
		kb.handleKeyDown(keyDown('KeyG'));
		expect(host.toggleGrid).toHaveBeenCalledOnce();
	});

	it('ignores repeat events', () => {
		const host = createHost();
		const kb = createKeyboardInput(host);
		kb.handleKeyDown(keyDown('KeyG'));
		kb.handleKeyDown(keyDown('KeyG', { repeat: true }));
		expect(host.toggleGrid).toHaveBeenCalledOnce();
	});

	it('allows toggle while drawing', () => {
		const host = createHost({ isDrawing: vi.fn(() => true) });
		const kb = createKeyboardInput(host);
		kb.handleKeyDown(keyDown('KeyG'));
		expect(host.toggleGrid).toHaveBeenCalledOnce();
	});

	it('ignores when modifiers held', () => {
		const host = createHost();
		const kb = createKeyboardInput(host);
		kb.handleKeyDown(keyDown('KeyG', { shiftKey: true }));
		expect(host.toggleGrid).not.toHaveBeenCalled();
	});
});

// ── Swap colors (X key) ─────────────────────────────────────

describe('swap colors (X key)', () => {
	it('calls swapColors', () => {
		const host = createHost();
		const kb = createKeyboardInput(host);
		kb.handleKeyDown(keyDown('KeyX'));
		expect(host.swapColors).toHaveBeenCalledOnce();
	});

	it('ignores repeat events', () => {
		const host = createHost();
		const kb = createKeyboardInput(host);
		kb.handleKeyDown(keyDown('KeyX'));
		kb.handleKeyDown(keyDown('KeyX', { repeat: true }));
		expect(host.swapColors).toHaveBeenCalledOnce();
	});

	it('allows swap while drawing', () => {
		const host = createHost({ isDrawing: vi.fn(() => true) });
		const kb = createKeyboardInput(host);
		kb.handleKeyDown(keyDown('KeyX'));
		expect(host.swapColors).toHaveBeenCalledOnce();
	});
});

// ── Undo/Redo shortcuts ─────────────────────────────────────

describe('undo/redo shortcuts', () => {
	it('calls undo on Ctrl+Z', () => {
		const host = createHost();
		const kb = createKeyboardInput(host);
		kb.handleKeyDown(keyDown('KeyZ', { key: 'z', ctrlKey: true }));
		expect(host.undo).toHaveBeenCalledOnce();
	});

	it('calls redo on Ctrl+Shift+Z', () => {
		const host = createHost();
		const kb = createKeyboardInput(host);
		kb.handleKeyDown(keyDown('KeyZ', { key: 'z', ctrlKey: true, shiftKey: true }));
		expect(host.redo).toHaveBeenCalledOnce();
	});

	it('calls redo on Ctrl+Y', () => {
		const host = createHost();
		const kb = createKeyboardInput(host);
		kb.handleKeyDown(keyDown('KeyY', { key: 'y', ctrlKey: true }));
		expect(host.redo).toHaveBeenCalledOnce();
	});

	it('calls undo on Cmd+Z (macOS)', () => {
		const host = createHost();
		const kb = createKeyboardInput(host);
		kb.handleKeyDown(keyDown('KeyZ', { key: 'z', metaKey: true }));
		expect(host.undo).toHaveBeenCalledOnce();
	});

	it('calls redo on Cmd+Y (macOS)', () => {
		const host = createHost();
		const kb = createKeyboardInput(host);
		kb.handleKeyDown(keyDown('KeyY', { key: 'y', metaKey: true }));
		expect(host.redo).toHaveBeenCalledOnce();
	});

	it('calls preventDefault for undo/redo', () => {
		const kb = createKeyboardInput(createHost());
		const event = keyDown('KeyZ', { key: 'z', ctrlKey: true });
		kb.handleKeyDown(event);
		expect(event.preventDefault).toHaveBeenCalled();
	});
});

// ── Alt eyedropper (temporary tool switch) ───────────────────

describe('Alt eyedropper', () => {
	it('switches to eyedropper on Alt press and restores on release', () => {
		const host = createHost({ getActiveTool: vi.fn(() => 'pencil' as const) });
		const kb = createKeyboardInput(host);

		kb.handleKeyDown(keyDown('AltLeft'));
		expect(host.setActiveTool).toHaveBeenCalledWith('eyedropper');

		kb.handleKeyUp(keyUp('AltLeft'));
		expect(host.setActiveTool).toHaveBeenCalledWith('pencil');
	});

	it('does not switch when already using eyedropper', () => {
		const host = createHost({ getActiveTool: vi.fn(() => 'eyedropper' as const) });
		const kb = createKeyboardInput(host);

		kb.handleKeyDown(keyDown('AltLeft'));
		expect(host.setActiveTool).not.toHaveBeenCalled();

		kb.handleKeyUp(keyUp('AltLeft'));
		expect(host.setActiveTool).not.toHaveBeenCalled();
	});

	it('ignores Alt repeat events', () => {
		let currentTool: string = 'eraser';
		const host = createHost({
			getActiveTool: vi.fn(() => currentTool as ToolType),
			setActiveTool: vi.fn((tool: ToolType) => { currentTool = tool; })
		});
		const kb = createKeyboardInput(host);

		kb.handleKeyDown(keyDown('AltLeft'));
		expect(host.setActiveTool).toHaveBeenCalledWith('eyedropper');

		// Repeat should not re-save toolBeforeModifier
		kb.handleKeyDown(keyDown('AltLeft', { repeat: true }));

		kb.handleKeyUp(keyUp('AltLeft'));
		expect(host.setActiveTool).toHaveBeenCalledWith('eraser');
	});

	it('does not switch tool when Alt pressed during drawing', () => {
		const host = createHost({ isDrawing: vi.fn(() => true) });
		const kb = createKeyboardInput(host);

		kb.handleKeyDown(keyDown('AltLeft'));
		expect(host.setActiveTool).not.toHaveBeenCalled();
	});

	it('defers tool restore when Alt released during drawing', () => {
		let drawing = false;
		const host = createHost({
			getActiveTool: vi.fn(() => 'pencil' as const),
			isDrawing: vi.fn(() => drawing)
		});
		const kb = createKeyboardInput(host);

		kb.handleKeyDown(keyDown('AltLeft'));
		expect(host.setActiveTool).toHaveBeenCalledWith('eyedropper');

		// Start drawing, then release Alt
		drawing = true;
		kb.handleKeyUp(keyUp('AltLeft'));
		// Should NOT restore yet — deferred
		expect(host.setActiveTool).toHaveBeenCalledTimes(1);

		// consumePendingToolRestore returns the saved tool
		const restored = kb.consumePendingToolRestore();
		expect(restored).toBe('pencil');
	});

	it('consumePendingToolRestore returns null when Alt is still held', () => {
		let drawing = false;
		const host = createHost({
			getActiveTool: vi.fn(() => 'pencil' as const),
			isDrawing: vi.fn(() => drawing)
		});
		const kb = createKeyboardInput(host);

		kb.handleKeyDown(keyDown('AltLeft'));
		drawing = true;
		// Alt still held, drawing ends
		const restored = kb.consumePendingToolRestore();
		expect(restored).toBe(null);
	});

	it('consumePendingToolRestore consumes state — second call returns null', () => {
		let drawing = false;
		const host = createHost({
			getActiveTool: vi.fn(() => 'pencil' as const),
			isDrawing: vi.fn(() => drawing)
		});
		const kb = createKeyboardInput(host);

		kb.handleKeyDown(keyDown('AltLeft'));
		drawing = true;
		kb.handleKeyUp(keyUp('AltLeft'));

		expect(kb.consumePendingToolRestore()).toBe('pencil');
		expect(kb.consumePendingToolRestore()).toBe(null);
	});

	it('restores tool on window blur', () => {
		const host = createHost({ getActiveTool: vi.fn(() => 'line' as const) });
		const kb = createKeyboardInput(host);

		kb.handleKeyDown(keyDown('AltLeft'));
		expect(host.setActiveTool).toHaveBeenCalledWith('eyedropper');

		kb.handleBlur();
		expect(host.setActiveTool).toHaveBeenCalledWith('line');
	});

	it('works with AltRight', () => {
		const host = createHost({ getActiveTool: vi.fn(() => 'rectangle' as const) });
		const kb = createKeyboardInput(host);

		kb.handleKeyDown(keyDown('AltRight'));
		expect(host.setActiveTool).toHaveBeenCalledWith('eyedropper');

		kb.handleKeyUp(keyUp('AltRight'));
		expect(host.setActiveTool).toHaveBeenCalledWith('rectangle');
	});
});

// ── Mid-stroke modifier change ───────────────────────────────

describe('mid-stroke modifier change', () => {
	it('calls notifyModifierChange when Shift pressed during drawing', () => {
		const host = createHost({ isDrawing: vi.fn(() => true) });
		const kb = createKeyboardInput(host);

		kb.handleKeyDown(keyDown('ShiftLeft'));
		expect(host.notifyModifierChange).toHaveBeenCalledOnce();
	});

	it('calls notifyModifierChange when Shift released during drawing', () => {
		const host = createHost({ isDrawing: vi.fn(() => true) });
		const kb = createKeyboardInput(host);

		kb.handleKeyDown(keyDown('ShiftLeft'));
		kb.handleKeyUp(keyUp('ShiftLeft'));
		expect(host.notifyModifierChange).toHaveBeenCalledTimes(2);
	});

	it('does not call notifyModifierChange when not drawing', () => {
		const host = createHost({ isDrawing: vi.fn(() => false) });
		const kb = createKeyboardInput(host);

		kb.handleKeyDown(keyDown('ShiftLeft'));
		kb.handleKeyUp(keyUp('ShiftLeft'));
		expect(host.notifyModifierChange).not.toHaveBeenCalled();
	});
});
