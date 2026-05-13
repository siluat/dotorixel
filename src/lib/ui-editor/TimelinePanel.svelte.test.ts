// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/svelte';
import TimelinePanel from './TimelinePanel.svelte';

afterEach(() => {
	cleanup();
});

const noopAddLayer = () => {};
const noopActivateLayer = (_id: string) => {};
const noopRemoveLayer = (_id: string) => {};
const noopReorderLayer = (_id: string, _newVisualIndex: number) => {};

const defaultProps = {
	onAddLayer: noopAddLayer,
	onActivateLayer: noopActivateLayer,
	onRemoveLayer: noopRemoveLayer,
	onReorderLayer: noopReorderLayer
};

describe('TimelinePanel', () => {
	it('renders a single row showing the layer name when one layer is provided', () => {
		const layers = [{ id: 'a', name: 'Layer 1' }];
		const { container } = render(TimelinePanel, {
			props: {
				layers,
				activeLayerId: 'a',
				onAddLayer: noopAddLayer,
				onActivateLayer: noopActivateLayer,
				onRemoveLayer: noopRemoveLayer,
				onReorderLayer: noopReorderLayer
			}
		});

		const rows = container.querySelectorAll('[data-layer-row]');
		expect(rows.length).toBe(1);
		expect(rows[0].textContent).toContain('Layer 1');
	});

	it('renders one row per layer with each layer name visible', () => {
		const layers = [
			{ id: 'a', name: 'Layer 1' },
			{ id: 'b', name: 'Layer 2' },
			{ id: 'c', name: 'Hair' }
		];
		const { container } = render(TimelinePanel, {
			props: {
				layers,
				activeLayerId: 'a',
				onAddLayer: noopAddLayer,
				onActivateLayer: noopActivateLayer,
				onRemoveLayer: noopRemoveLayer,
				onReorderLayer: noopReorderLayer
			}
		});

		const rows = container.querySelectorAll('[data-layer-row]');
		expect(rows.length).toBe(3);
		const names = Array.from(rows).map((r) => r.querySelector('.name')?.textContent?.trim());
		expect(names).toEqual(expect.arrayContaining(['Layer 1', 'Layer 2', 'Hair']));
	});

	it('marks the active layer row with aria-current and leaves others unmarked', () => {
		const layers = [
			{ id: 'a', name: 'Layer 1' },
			{ id: 'b', name: 'Layer 2' },
			{ id: 'c', name: 'Layer 3' }
		];
		const { container } = render(TimelinePanel, {
			props: {
				layers,
				activeLayerId: 'b',
				onAddLayer: noopAddLayer,
				onActivateLayer: noopActivateLayer,
				onRemoveLayer: noopRemoveLayer,
				onReorderLayer: noopReorderLayer
			}
		});

		const rowB = container.querySelector('[data-layer-row][data-layer-id="b"]');
		const rowA = container.querySelector('[data-layer-row][data-layer-id="a"]');
		const rowC = container.querySelector('[data-layer-row][data-layer-id="c"]');

		expect(rowB?.getAttribute('aria-current')).toBe('true');
		expect(rowA?.hasAttribute('aria-current')).toBe(false);
		expect(rowC?.hasAttribute('aria-current')).toBe(false);
	});

	it('renders an add-layer button in the header', () => {
		const layers = [{ id: 'a', name: 'Layer 1' }];
		const { container } = render(TimelinePanel, {
			props: {
				layers,
				activeLayerId: 'a',
				onAddLayer: noopAddLayer,
				onActivateLayer: noopActivateLayer,
				onRemoveLayer: noopRemoveLayer,
				onReorderLayer: noopReorderLayer
			}
		});

		const button = container.querySelector('[data-add-layer]');
		expect(button).not.toBeNull();
		expect(button?.tagName).toBe('BUTTON');
	});

	it('invokes onAddLayer when the add-layer button is clicked', async () => {
		const layers = [{ id: 'a', name: 'Layer 1' }];
		const onAddLayer = vi.fn();
		const { container } = render(TimelinePanel, {
			props: {
				layers,
				activeLayerId: 'a',
				onAddLayer,
				onActivateLayer: noopActivateLayer,
				onRemoveLayer: noopRemoveLayer,
				onReorderLayer: noopReorderLayer
			}
		});

		const button = container.querySelector('[data-add-layer]') as HTMLButtonElement;
		await fireEvent.click(button);

		expect(onAddLayer).toHaveBeenCalledTimes(1);
	});

	it('invokes onActivateLayer with the layer id when a non-active row is clicked', async () => {
		const layers = [
			{ id: 'a', name: 'Layer 1' },
			{ id: 'b', name: 'Layer 2' }
		];
		const onActivateLayer = vi.fn();
		const { container } = render(TimelinePanel, {
			props: {
				layers,
				activeLayerId: 'a',
				onAddLayer: noopAddLayer,
				onActivateLayer,
				onRemoveLayer: noopRemoveLayer,
				onReorderLayer: noopReorderLayer
			}
		});

		const rowB = container.querySelector('[data-layer-row][data-layer-id="b"]') as HTMLElement;
		await fireEvent.click(rowB);

		expect(onActivateLayer).toHaveBeenCalledWith('b');
		expect(onActivateLayer).toHaveBeenCalledTimes(1);
	});

	it('renders a remove affordance on every layer row', () => {
		const layers = [
			{ id: 'a', name: 'Layer 1' },
			{ id: 'b', name: 'Layer 2' },
			{ id: 'c', name: 'Layer 3' }
		];
		const { container } = render(TimelinePanel, {
			props: {
				layers,
				activeLayerId: 'a',
				onAddLayer: noopAddLayer,
				onActivateLayer: noopActivateLayer,
				onRemoveLayer: noopRemoveLayer,
				onReorderLayer: noopReorderLayer
			}
		});

		const removeButtons = container.querySelectorAll('[data-remove-layer]');
		expect(removeButtons.length).toBe(3);
		for (const btn of removeButtons) {
			expect(btn.tagName).toBe('BUTTON');
		}
	});

	it('invokes onRemoveLayer with that row’s layer id when its remove button is clicked', async () => {
		const layers = [
			{ id: 'a', name: 'Layer 1' },
			{ id: 'b', name: 'Layer 2' }
		];
		const onRemoveLayer = vi.fn();
		const { container } = render(TimelinePanel, {
			props: {
				layers,
				activeLayerId: 'a',
				onAddLayer: noopAddLayer,
				onActivateLayer: noopActivateLayer,
				onRemoveLayer,
				onReorderLayer: noopReorderLayer
			}
		});

		const rowB = container.querySelector('[data-layer-row][data-layer-id="b"]') as HTMLElement;
		const btn = rowB.querySelector('[data-remove-layer]') as HTMLButtonElement;
		await fireEvent.click(btn);

		expect(onRemoveLayer).toHaveBeenCalledWith('b');
		expect(onRemoveLayer).toHaveBeenCalledTimes(1);
	});

	it('clicking the remove button does not also activate that row', async () => {
		const layers = [
			{ id: 'a', name: 'Layer 1' },
			{ id: 'b', name: 'Layer 2' }
		];
		const onActivateLayer = vi.fn();
		const { container } = render(TimelinePanel, {
			props: {
				layers,
				activeLayerId: 'a',
				onAddLayer: noopAddLayer,
				onActivateLayer,
				onRemoveLayer: noopRemoveLayer,
				onReorderLayer: noopReorderLayer
			}
		});

		const rowB = container.querySelector('[data-layer-row][data-layer-id="b"]') as HTMLElement;
		const btn = rowB.querySelector('[data-remove-layer]') as HTMLButtonElement;
		await fireEvent.click(btn);

		expect(onActivateLayer).not.toHaveBeenCalled();
	});

	it.each([
		['Enter', 'Enter'],
		['Space', ' ']
	])('pressing %s on the remove button does not activate the row', async (_label, key) => {
		const layers = [
			{ id: 'a', name: 'Layer 1' },
			{ id: 'b', name: 'Layer 2' }
		];
		const onActivateLayer = vi.fn();
		const { container } = render(TimelinePanel, {
			props: {
				layers,
				activeLayerId: 'a',
				onAddLayer: noopAddLayer,
				onActivateLayer,
				onRemoveLayer: noopRemoveLayer,
				onReorderLayer: noopReorderLayer
			}
		});

		const rowB = container.querySelector('[data-layer-row][data-layer-id="b"]') as HTMLElement;
		const btn = rowB.querySelector('[data-remove-layer]') as HTMLButtonElement;
		btn.focus();
		await fireEvent.keyDown(btn, { key });

		expect(onActivateLayer).not.toHaveBeenCalled();
	});

	it('disables the remove button when only one layer remains', () => {
		const layers = [{ id: 'a', name: 'Layer 1' }];
		const { container } = render(TimelinePanel, {
			props: {
				layers,
				activeLayerId: 'a',
				onAddLayer: noopAddLayer,
				onActivateLayer: noopActivateLayer,
				onRemoveLayer: noopRemoveLayer,
				onReorderLayer: noopReorderLayer
			}
		});

		const btn = container.querySelector('[data-remove-layer]') as HTMLButtonElement;
		expect(btn.disabled).toBe(true);
	});

	it('enables the remove button on every row when two or more layers are present', () => {
		const layers = [
			{ id: 'a', name: 'Layer 1' },
			{ id: 'b', name: 'Layer 2' }
		];
		const { container } = render(TimelinePanel, {
			props: {
				layers,
				activeLayerId: 'a',
				onAddLayer: noopAddLayer,
				onActivateLayer: noopActivateLayer,
				onRemoveLayer: noopRemoveLayer,
				onReorderLayer: noopReorderLayer
			}
		});

		const btns = container.querySelectorAll<HTMLButtonElement>('[data-remove-layer]');
		expect(btns.length).toBe(2);
		for (const b of btns) expect(b.disabled).toBe(false);
	});

	it('renders a reorder handle on every layer row', () => {
		const layers = [
			{ id: 'a', name: 'Layer 1' },
			{ id: 'b', name: 'Layer 2' },
			{ id: 'c', name: 'Layer 3' }
		];
		const { container } = render(TimelinePanel, {
			props: { layers, activeLayerId: 'a', ...defaultProps }
		});

		const handles = container.querySelectorAll('[data-reorder-handle]');
		expect(handles.length).toBe(3);
		for (const h of handles) {
			expect(h.tagName).toBe('BUTTON');
		}
	});

	it('disables the reorder handle when only one layer remains', () => {
		const layers = [{ id: 'a', name: 'Layer 1' }];
		const { container } = render(TimelinePanel, {
			props: { layers, activeLayerId: 'a', ...defaultProps }
		});

		const handle = container.querySelector('[data-reorder-handle]') as HTMLButtonElement;
		expect(handle.disabled).toBe(true);
	});

	it('enables the reorder handle on every row when two or more layers are present', () => {
		const layers = [
			{ id: 'a', name: 'Layer 1' },
			{ id: 'b', name: 'Layer 2' }
		];
		const { container } = render(TimelinePanel, {
			props: { layers, activeLayerId: 'a', ...defaultProps }
		});

		const handles = container.querySelectorAll<HTMLButtonElement>('[data-reorder-handle]');
		for (const h of handles) expect(h.disabled).toBe(false);
	});

	it('clicking the reorder handle does not activate the row', async () => {
		const layers = [
			{ id: 'a', name: 'Layer 1' },
			{ id: 'b', name: 'Layer 2' }
		];
		const onActivateLayer = vi.fn();
		const { container } = render(TimelinePanel, {
			props: { layers, activeLayerId: 'a', ...defaultProps, onActivateLayer }
		});

		const rowB = container.querySelector('[data-layer-row][data-layer-id="b"]') as HTMLElement;
		const handle = rowB.querySelector('[data-reorder-handle]') as HTMLButtonElement;
		await fireEvent.click(handle);

		expect(onActivateLayer).not.toHaveBeenCalled();
	});

	it.each([
		['Enter', 'Enter'],
		['Space', ' ']
	])('pressing %s on the reorder handle does not activate the row', async (_label, key) => {
		const layers = [
			{ id: 'a', name: 'Layer 1' },
			{ id: 'b', name: 'Layer 2' }
		];
		const onActivateLayer = vi.fn();
		const { container } = render(TimelinePanel, {
			props: { layers, activeLayerId: 'a', ...defaultProps, onActivateLayer }
		});

		const rowB = container.querySelector('[data-layer-row][data-layer-id="b"]') as HTMLElement;
		const handle = rowB.querySelector('[data-reorder-handle]') as HTMLButtonElement;
		handle.focus();
		await fireEvent.keyDown(handle, { key });

		expect(onActivateLayer).not.toHaveBeenCalled();
	});

	it('ArrowUp on a focused reorder handle moves the layer up one visual position', async () => {
		// Panel order (top→bottom): [Layer 3 (id c), Layer 2 (id b), Layer 1 (id a)]
		const layers = [
			{ id: 'c', name: 'Layer 3' },
			{ id: 'b', name: 'Layer 2' },
			{ id: 'a', name: 'Layer 1' }
		];
		const onReorderLayer = vi.fn();
		const { container } = render(TimelinePanel, {
			props: { layers, activeLayerId: 'a', ...defaultProps, onReorderLayer }
		});

		const rowB = container.querySelector('[data-layer-row][data-layer-id="b"]') as HTMLElement;
		const handle = rowB.querySelector('[data-reorder-handle]') as HTMLButtonElement;
		handle.focus();
		await fireEvent.keyDown(handle, { key: 'ArrowUp' });

		// Layer b is currently at visual index 1; ArrowUp targets visual index 0.
		expect(onReorderLayer).toHaveBeenCalledWith('b', 0);
		expect(onReorderLayer).toHaveBeenCalledTimes(1);
	});

	it('ArrowDown on a focused reorder handle moves the layer down one visual position', async () => {
		const layers = [
			{ id: 'c', name: 'Layer 3' },
			{ id: 'b', name: 'Layer 2' },
			{ id: 'a', name: 'Layer 1' }
		];
		const onReorderLayer = vi.fn();
		const { container } = render(TimelinePanel, {
			props: { layers, activeLayerId: 'a', ...defaultProps, onReorderLayer }
		});

		const rowB = container.querySelector('[data-layer-row][data-layer-id="b"]') as HTMLElement;
		const handle = rowB.querySelector('[data-reorder-handle]') as HTMLButtonElement;
		handle.focus();
		await fireEvent.keyDown(handle, { key: 'ArrowDown' });

		// Layer b is currently at visual index 1; ArrowDown targets visual index 2.
		expect(onReorderLayer).toHaveBeenCalledWith('b', 2);
	});

	it('ArrowUp on the top-row reorder handle is a no-op', async () => {
		const layers = [
			{ id: 'c', name: 'Layer 3' },
			{ id: 'b', name: 'Layer 2' },
			{ id: 'a', name: 'Layer 1' }
		];
		const onReorderLayer = vi.fn();
		const { container } = render(TimelinePanel, {
			props: { layers, activeLayerId: 'a', ...defaultProps, onReorderLayer }
		});

		const rowC = container.querySelector('[data-layer-row][data-layer-id="c"]') as HTMLElement;
		const handle = rowC.querySelector('[data-reorder-handle]') as HTMLButtonElement;
		handle.focus();
		await fireEvent.keyDown(handle, { key: 'ArrowUp' });

		expect(onReorderLayer).not.toHaveBeenCalled();
	});

	it('ArrowDown on the bottom-row reorder handle is a no-op', async () => {
		const layers = [
			{ id: 'c', name: 'Layer 3' },
			{ id: 'b', name: 'Layer 2' },
			{ id: 'a', name: 'Layer 1' }
		];
		const onReorderLayer = vi.fn();
		const { container } = render(TimelinePanel, {
			props: { layers, activeLayerId: 'a', ...defaultProps, onReorderLayer }
		});

		const rowA = container.querySelector('[data-layer-row][data-layer-id="a"]') as HTMLElement;
		const handle = rowA.querySelector('[data-reorder-handle]') as HTMLButtonElement;
		handle.focus();
		await fireEvent.keyDown(handle, { key: 'ArrowDown' });

		expect(onReorderLayer).not.toHaveBeenCalled();
	});

	it('dragging row C and dropping on row A calls onReorderLayer with the target row’s visual index', async () => {
		const layers = [
			{ id: 'c', name: 'Layer 3' },
			{ id: 'b', name: 'Layer 2' },
			{ id: 'a', name: 'Layer 1' }
		];
		const onReorderLayer = vi.fn();
		const { container } = render(TimelinePanel, {
			props: { layers, activeLayerId: 'a', ...defaultProps, onReorderLayer }
		});

		const rowC = container.querySelector('[data-layer-row][data-layer-id="c"]') as HTMLElement;
		const rowA = container.querySelector('[data-layer-row][data-layer-id="a"]') as HTMLElement;
		const handleC = rowC.querySelector('[data-reorder-handle]') as HTMLButtonElement;

		const dataTransfer = new DataTransfer();
		await fireEvent.dragStart(handleC, { dataTransfer });
		await fireEvent.dragOver(rowA, { dataTransfer });
		await fireEvent.drop(rowA, { dataTransfer });

		// Row A is at visual index 2; dropping the dragged Layer 3 there should
		// request reorder to visual index 2.
		expect(onReorderLayer).toHaveBeenCalledWith('c', 2);
	});

	it('activates the row when Enter or Space is pressed on a focused row', async () => {
		const layers = [
			{ id: 'a', name: 'Layer 1' },
			{ id: 'b', name: 'Layer 2' }
		];
		const onActivateLayer = vi.fn();
		const { container } = render(TimelinePanel, {
			props: {
				layers,
				activeLayerId: 'a',
				onAddLayer: noopAddLayer,
				onActivateLayer,
				onRemoveLayer: noopRemoveLayer,
				onReorderLayer: noopReorderLayer
			}
		});

		const rowB = container.querySelector('[data-layer-row][data-layer-id="b"]') as HTMLElement;
		rowB.focus();
		expect(document.activeElement).toBe(rowB);

		await fireEvent.keyDown(rowB, { key: 'Enter' });
		expect(onActivateLayer).toHaveBeenCalledWith('b');
		expect(onActivateLayer).toHaveBeenCalledTimes(1);

		onActivateLayer.mockClear();
		await fireEvent.keyDown(rowB, { key: ' ' });
		expect(onActivateLayer).toHaveBeenCalledWith('b');
		expect(onActivateLayer).toHaveBeenCalledTimes(1);
	});
});
