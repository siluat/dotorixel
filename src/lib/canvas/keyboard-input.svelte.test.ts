// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { createKeyboardInput, type KeyboardInputHost } from './keyboard-input.svelte';

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
	it('sets shortcutHintsVisible on press, clears on release', () => {
		const kb = createKeyboardInput(createHost());
		expect(kb.shortcutHintsVisible).toBe(false);

		kb.handleKeyDown(keyDown('Slash'));
		expect(kb.shortcutHintsVisible).toBe(true);

		kb.handleKeyUp(keyUp('Slash'));
		expect(kb.shortcutHintsVisible).toBe(false);
	});

	it('ignores repeat events', () => {
		const kb = createKeyboardInput(createHost());
		kb.handleKeyDown(keyDown('Slash'));
		kb.handleKeyDown(keyDown('Slash', { repeat: true }));
		expect(kb.shortcutHintsVisible).toBe(true);
	});

	it('does not show hints while drawing', () => {
		const host = createHost({ isDrawing: vi.fn(() => true) });
		const kb = createKeyboardInput(host);

		kb.handleKeyDown(keyDown('Slash'));
		expect(kb.shortcutHintsVisible).toBe(false);
	});

	it('resets on blur', () => {
		const kb = createKeyboardInput(createHost());
		kb.handleKeyDown(keyDown('Slash'));
		kb.handleBlur();
		expect(kb.shortcutHintsVisible).toBe(false);
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
