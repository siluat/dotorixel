// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { clickOutside } from './click-outside';

describe('clickOutside', () => {
	it('calls handler when clicking outside the element', () => {
		const node = document.createElement('div');
		document.body.appendChild(node);

		const handler = vi.fn();
		const action = clickOutside(node, { onClose: handler });

		document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));

		expect(handler).toHaveBeenCalledOnce();

		action.destroy();
		node.remove();
	});

	it('does not call handler when clicking inside the element', () => {
		const node = document.createElement('div');
		const child = document.createElement('span');
		node.appendChild(child);
		document.body.appendChild(node);

		const handler = vi.fn();
		const action = clickOutside(node, { onClose: handler });

		child.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));

		expect(handler).not.toHaveBeenCalled();

		action.destroy();
		node.remove();
	});

	it('does not call handler when clicking an excluded element', () => {
		const node = document.createElement('div');
		const excluded = document.createElement('button');
		document.body.appendChild(node);
		document.body.appendChild(excluded);

		const handler = vi.fn();
		const action = clickOutside(node, { onClose: handler, exclude: [excluded] });

		excluded.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));

		expect(handler).not.toHaveBeenCalled();

		action.destroy();
		node.remove();
		excluded.remove();
	});

	it('does not call handler after destroy', () => {
		const node = document.createElement('div');
		document.body.appendChild(node);

		const handler = vi.fn();
		const action = clickOutside(node, { onClose: handler });
		action.destroy();

		document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));

		expect(handler).not.toHaveBeenCalled();

		node.remove();
	});
});
