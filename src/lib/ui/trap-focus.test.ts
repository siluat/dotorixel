// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { trapFocus } from './trap-focus';

function createContainer(...elements: string[]): HTMLElement {
	const container = document.createElement('div');
	for (const tag of elements) {
		const el = document.createElement(tag);
		container.appendChild(el);
	}
	document.body.appendChild(container);
	return container;
}

function tabEvent(shift = false): KeyboardEvent {
	return new KeyboardEvent('keydown', {
		key: 'Tab',
		shiftKey: shift,
		bubbles: true,
		cancelable: true
	});
}

describe('trapFocus', () => {
	it('Tab cycles forward through focusable elements', () => {
		const container = createContainer('button', 'button', 'button');
		const buttons = container.querySelectorAll('button');
		(buttons[0] as HTMLElement).focus();

		trapFocus(tabEvent(), container);
		expect(document.activeElement).toBe(buttons[1]);

		trapFocus(tabEvent(), container);
		expect(document.activeElement).toBe(buttons[2]);
	});

	it('Shift+Tab cycles backward through focusable elements', () => {
		const container = createContainer('button', 'button', 'button');
		const buttons = container.querySelectorAll('button');
		(buttons[2] as HTMLElement).focus();

		trapFocus(tabEvent(true), container);
		expect(document.activeElement).toBe(buttons[1]);

		trapFocus(tabEvent(true), container);
		expect(document.activeElement).toBe(buttons[0]);
	});

	it('wraps from last to first on Tab', () => {
		const container = createContainer('button', 'button');
		const buttons = container.querySelectorAll('button');
		(buttons[1] as HTMLElement).focus();

		trapFocus(tabEvent(), container);
		expect(document.activeElement).toBe(buttons[0]);
	});

	it('wraps from first to last on Shift+Tab', () => {
		const container = createContainer('button', 'button');
		const buttons = container.querySelectorAll('button');
		(buttons[0] as HTMLElement).focus();

		trapFocus(tabEvent(true), container);
		expect(document.activeElement).toBe(buttons[1]);
	});

	it('no-ops on empty container', () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const event = tabEvent();

		trapFocus(event, container);

		// No error thrown, default not prevented
		expect(event.defaultPrevented).toBe(false);
	});

	it('includes inputs and elements with tabindex', () => {
		const container = document.createElement('div');
		const input = document.createElement('input');
		const div = document.createElement('div');
		div.setAttribute('tabindex', '0');
		container.appendChild(input);
		container.appendChild(div);
		document.body.appendChild(container);

		input.focus();

		trapFocus(tabEvent(), container);
		expect(document.activeElement).toBe(div);
	});

	it('skips disabled buttons', () => {
		const container = document.createElement('div');
		const btn1 = document.createElement('button');
		const btn2 = document.createElement('button');
		btn2.disabled = true;
		const btn3 = document.createElement('button');
		container.appendChild(btn1);
		container.appendChild(btn2);
		container.appendChild(btn3);
		document.body.appendChild(container);

		btn1.focus();

		trapFocus(tabEvent(), container);
		expect(document.activeElement).toBe(btn3);
	});
});
