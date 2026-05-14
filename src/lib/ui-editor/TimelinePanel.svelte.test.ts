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
const noopToggleLayerVisibility = (_id: string, _visible: boolean) => {};

const defaultProps = {
	onAddLayer: noopAddLayer,
	onActivateLayer: noopActivateLayer,
	onRemoveLayer: noopRemoveLayer,
	onReorderLayer: noopReorderLayer,
	onToggleLayerVisibility: noopToggleLayerVisibility
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
				onReorderLayer: noopReorderLayer,
				onToggleLayerVisibility: noopToggleLayerVisibility
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
				onReorderLayer: noopReorderLayer,
				onToggleLayerVisibility: noopToggleLayerVisibility
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
				onReorderLayer: noopReorderLayer,
				onToggleLayerVisibility: noopToggleLayerVisibility
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
				onReorderLayer: noopReorderLayer,
				onToggleLayerVisibility: noopToggleLayerVisibility
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
				onReorderLayer: noopReorderLayer,
				onToggleLayerVisibility: noopToggleLayerVisibility
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
				onReorderLayer: noopReorderLayer,
				onToggleLayerVisibility: noopToggleLayerVisibility
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
				onReorderLayer: noopReorderLayer,
				onToggleLayerVisibility: noopToggleLayerVisibility
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
				onReorderLayer: noopReorderLayer,
				onToggleLayerVisibility: noopToggleLayerVisibility
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
				onReorderLayer: noopReorderLayer,
				onToggleLayerVisibility: noopToggleLayerVisibility
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
				onReorderLayer: noopReorderLayer,
				onToggleLayerVisibility: noopToggleLayerVisibility
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
				onReorderLayer: noopReorderLayer,
				onToggleLayerVisibility: noopToggleLayerVisibility
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
				onReorderLayer: noopReorderLayer,
				onToggleLayerVisibility: noopToggleLayerVisibility
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

	it('pointer-dragging row C downward by two row-heights and releasing calls onReorderLayer with the dropped visual index', async () => {
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
		const handleC = rowC.querySelector('[data-reorder-handle]') as HTMLButtonElement;

		await fireEvent.pointerDown(handleC, { clientY: 0, pointerId: 1 });
		await fireEvent.pointerMove(handleC, { clientY: 64, pointerId: 1 });
		await fireEvent.pointerUp(handleC, { clientY: 64, pointerId: 1 });

		expect(onReorderLayer).toHaveBeenCalledWith('c', 2);
	});

	it('pointer cancel during a drag does not call onReorderLayer', async () => {
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
		const handleC = rowC.querySelector('[data-reorder-handle]') as HTMLButtonElement;

		await fireEvent.pointerDown(handleC, { clientY: 0, pointerId: 1 });
		await fireEvent.pointerMove(handleC, { clientY: 64, pointerId: 1 });
		await fireEvent.pointerCancel(handleC, { pointerId: 1 });

		expect(onReorderLayer).not.toHaveBeenCalled();
	});

	it('pointer release at a Y different from the last pointermove uses the release Y for the target', async () => {
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
		const handleC = rowC.querySelector('[data-reorder-handle]') as HTMLButtonElement;

		await fireEvent.pointerDown(handleC, { clientY: 0, pointerId: 1 });
		await fireEvent.pointerMove(handleC, { clientY: 32, pointerId: 1 });
		await fireEvent.pointerUp(handleC, { clientY: 64, pointerId: 1 });

		expect(onReorderLayer).toHaveBeenCalledWith('c', 2);
	});

	it('a second pointer landing during an active drag does not steal or reset it', async () => {
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
		const handleC = rowC.querySelector('[data-reorder-handle]') as HTMLButtonElement;
		const rowA = container.querySelector('[data-layer-row][data-layer-id="a"]') as HTMLElement;
		const handleA = rowA.querySelector('[data-reorder-handle]') as HTMLButtonElement;

		await fireEvent.pointerDown(handleC, { clientY: 0, pointerId: 1 });
		// Second finger lands on a different handle — must not start a second drag.
		await fireEvent.pointerDown(handleA, { clientY: 100, pointerId: 2 });
		// Events from the secondary pointer are also ignored.
		await fireEvent.pointerMove(handleC, { clientY: 200, pointerId: 2 });
		await fireEvent.pointerUp(handleC, { clientY: 200, pointerId: 2 });
		// Guard: the secondary pointer's release alone must not trigger reorder —
		// catches a regression where the pointerId check on pointerup is dropped.
		expect(onReorderLayer).not.toHaveBeenCalled();
		// The original pointer's release at deltaY=64 still drives the reorder.
		await fireEvent.pointerMove(handleC, { clientY: 64, pointerId: 1 });
		await fireEvent.pointerUp(handleC, { clientY: 64, pointerId: 1 });

		expect(onReorderLayer).toHaveBeenCalledTimes(1);
		expect(onReorderLayer).toHaveBeenCalledWith('c', 2);
	});

	it('pointer release at the original Y does not call onReorderLayer', async () => {
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
		const handleB = rowB.querySelector('[data-reorder-handle]') as HTMLButtonElement;

		await fireEvent.pointerDown(handleB, { clientY: 0, pointerId: 1 });
		await fireEvent.pointerMove(handleB, { clientY: 4, pointerId: 1 });
		await fireEvent.pointerUp(handleB, { clientY: 4, pointerId: 1 });

		expect(onReorderLayer).not.toHaveBeenCalled();
	});

	it('renders a visibility toggle on every layer row', () => {
		const layers = [
			{ id: 'a', name: 'Layer 1' },
			{ id: 'b', name: 'Layer 2' },
			{ id: 'c', name: 'Layer 3' }
		];
		const { container } = render(TimelinePanel, {
			props: { layers, activeLayerId: 'a', ...defaultProps }
		});

		const toggles = container.querySelectorAll('[data-visibility-toggle]');
		expect(toggles.length).toBe(3);
		for (const t of toggles) {
			expect(t.tagName).toBe('BUTTON');
		}
	});

	it('clicking a visible row’s visibility toggle invokes onToggleLayerVisibility(id, false)', async () => {
		const layers = [
			{ id: 'a', name: 'Layer 1', visible: true },
			{ id: 'b', name: 'Layer 2', visible: true }
		];
		const onToggleLayerVisibility = vi.fn();
		const { container } = render(TimelinePanel, {
			props: { layers, activeLayerId: 'a', ...defaultProps, onToggleLayerVisibility }
		});

		const rowB = container.querySelector('[data-layer-row][data-layer-id="b"]') as HTMLElement;
		const toggle = rowB.querySelector('[data-visibility-toggle]') as HTMLButtonElement;
		await fireEvent.click(toggle);

		expect(onToggleLayerVisibility).toHaveBeenCalledWith('b', false);
		expect(onToggleLayerVisibility).toHaveBeenCalledTimes(1);
	});

	it('clicking a hidden row’s visibility toggle invokes onToggleLayerVisibility(id, true)', async () => {
		const layers = [
			{ id: 'a', name: 'Layer 1', visible: true },
			{ id: 'b', name: 'Layer 2', visible: false }
		];
		const onToggleLayerVisibility = vi.fn();
		const { container } = render(TimelinePanel, {
			props: { layers, activeLayerId: 'a', ...defaultProps, onToggleLayerVisibility }
		});

		const rowB = container.querySelector('[data-layer-row][data-layer-id="b"]') as HTMLElement;
		const toggle = rowB.querySelector('[data-visibility-toggle]') as HTMLButtonElement;
		await fireEvent.click(toggle);

		expect(onToggleLayerVisibility).toHaveBeenCalledWith('b', true);
		expect(onToggleLayerVisibility).toHaveBeenCalledTimes(1);
	});

	it('clicking the visibility toggle does not also activate the row', async () => {
		const layers = [
			{ id: 'a', name: 'Layer 1' },
			{ id: 'b', name: 'Layer 2' }
		];
		const onActivateLayer = vi.fn();
		const { container } = render(TimelinePanel, {
			props: { layers, activeLayerId: 'a', ...defaultProps, onActivateLayer }
		});

		const rowB = container.querySelector('[data-layer-row][data-layer-id="b"]') as HTMLElement;
		const toggle = rowB.querySelector('[data-visibility-toggle]') as HTMLButtonElement;
		await fireEvent.click(toggle);

		expect(onActivateLayer).not.toHaveBeenCalled();
	});

	it.each([
		['Enter', 'Enter'],
		['Space', ' ']
	])('pressing %s on the visibility toggle does not activate the row', async (_label, key) => {
		const layers = [
			{ id: 'a', name: 'Layer 1' },
			{ id: 'b', name: 'Layer 2' }
		];
		const onActivateLayer = vi.fn();
		const { container } = render(TimelinePanel, {
			props: { layers, activeLayerId: 'a', ...defaultProps, onActivateLayer }
		});

		const rowB = container.querySelector('[data-layer-row][data-layer-id="b"]') as HTMLElement;
		const toggle = rowB.querySelector('[data-visibility-toggle]') as HTMLButtonElement;
		toggle.focus();
		await fireEvent.keyDown(toggle, { key });

		expect(onActivateLayer).not.toHaveBeenCalled();
	});

	it('uses a state-describing aria-label that switches between Hide and Show', () => {
		// Visible rows announce the action that the toggle will perform ("Hide …"),
		// hidden rows announce the inverse ("Show …"). No aria-pressed is used —
		// pairing a dynamic label with aria-pressed produces conflicting state
		// announcements (WAI-ARIA APG: the label must not change when state does).
		const layers = [
			{ id: 'a', name: 'Layer 1', visible: true },
			{ id: 'b', name: 'Layer 2', visible: false }
		];
		const { container } = render(TimelinePanel, {
			props: { layers, activeLayerId: 'a', ...defaultProps }
		});

		const rowA = container.querySelector('[data-layer-row][data-layer-id="a"]') as HTMLElement;
		const rowB = container.querySelector('[data-layer-row][data-layer-id="b"]') as HTMLElement;
		const toggleA = rowA.querySelector('[data-visibility-toggle]') as HTMLButtonElement;
		const toggleB = rowB.querySelector('[data-visibility-toggle]') as HTMLButtonElement;

		expect(toggleA.getAttribute('aria-label')).toMatch(/hide/i);
		expect(toggleB.getAttribute('aria-label')).toMatch(/show/i);
		expect(toggleA.hasAttribute('aria-pressed')).toBe(false);
		expect(toggleB.hasAttribute('aria-pressed')).toBe(false);
	});

	it('marks hidden rows with a class that is absent on visible rows', () => {
		const layers = [
			{ id: 'a', name: 'Layer 1', visible: true },
			{ id: 'b', name: 'Layer 2', visible: false }
		];
		const { container } = render(TimelinePanel, {
			props: { layers, activeLayerId: 'a', ...defaultProps }
		});

		const rowA = container.querySelector('[data-layer-row][data-layer-id="a"]') as HTMLElement;
		const rowB = container.querySelector('[data-layer-row][data-layer-id="b"]') as HTMLElement;

		expect(rowA.classList.contains('row--hidden')).toBe(false);
		expect(rowB.classList.contains('row--hidden')).toBe(true);
	});

	it('renders a collapse toggle button in the header', () => {
		const layers = [{ id: 'a', name: 'Layer 1' }];
		const { container } = render(TimelinePanel, {
			props: { layers, activeLayerId: 'a', ...defaultProps }
		});

		const toggle = container.querySelector('[data-collapse-toggle]');
		expect(toggle).not.toBeNull();
		expect(toggle?.tagName).toBe('BUTTON');
	});

	it('starts in the expanded state on first render', () => {
		const layers = [{ id: 'a', name: 'Layer 1' }];
		const { container } = render(TimelinePanel, {
			props: { layers, activeLayerId: 'a', ...defaultProps }
		});

		const panel = container.querySelector('.timeline-panel') as HTMLElement;
		expect(panel.getAttribute('data-collapsed')).toBe('false');
	});

	it('collapses when the collapse toggle is clicked', async () => {
		const layers = [{ id: 'a', name: 'Layer 1' }];
		const { container } = render(TimelinePanel, {
			props: { layers, activeLayerId: 'a', ...defaultProps }
		});

		const toggle = container.querySelector('[data-collapse-toggle]') as HTMLButtonElement;
		await fireEvent.click(toggle);

		const panel = container.querySelector('.timeline-panel') as HTMLElement;
		expect(panel.getAttribute('data-collapsed')).toBe('true');
	});

	it('expands again when the collapse toggle is clicked a second time', async () => {
		const layers = [{ id: 'a', name: 'Layer 1' }];
		const { container } = render(TimelinePanel, {
			props: { layers, activeLayerId: 'a', ...defaultProps }
		});

		const toggle = container.querySelector('[data-collapse-toggle]') as HTMLButtonElement;
		await fireEvent.click(toggle);
		await fireEvent.click(toggle);

		const panel = container.querySelector('.timeline-panel') as HTMLElement;
		expect(panel.getAttribute('data-collapsed')).toBe('false');
	});

	it('shows the active layer name in the header when collapsed', async () => {
		const layers = [
			{ id: 'a', name: 'Sky' },
			{ id: 'b', name: 'Mountains' }
		];
		const { container } = render(TimelinePanel, {
			props: { layers, activeLayerId: 'b', ...defaultProps }
		});

		const toggle = container.querySelector('[data-collapse-toggle]') as HTMLButtonElement;
		await fireEvent.click(toggle);

		const header = container.querySelector('.timeline-panel .header') as HTMLElement;
		expect(header.textContent).toContain('Mountains');
	});

	it('does not render the layer rows when collapsed', async () => {
		const layers = [
			{ id: 'a', name: 'Layer 1' },
			{ id: 'b', name: 'Layer 2' }
		];
		const { container } = render(TimelinePanel, {
			props: { layers, activeLayerId: 'a', ...defaultProps }
		});

		const toggle = container.querySelector('[data-collapse-toggle]') as HTMLButtonElement;
		await fireEvent.click(toggle);

		const rows = container.querySelectorAll('[data-layer-row]');
		expect(rows.length).toBe(0);
	});

	it('switches the collapse toggle aria-label between Collapse and Expand', async () => {
		const layers = [{ id: 'a', name: 'Layer 1' }];
		const { container } = render(TimelinePanel, {
			props: { layers, activeLayerId: 'a', ...defaultProps }
		});

		const toggle = container.querySelector('[data-collapse-toggle]') as HTMLButtonElement;
		expect(toggle.getAttribute('aria-label')).toMatch(/collapse/i);

		await fireEvent.click(toggle);
		expect(toggle.getAttribute('aria-label')).toMatch(/expand/i);
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
				onReorderLayer: noopReorderLayer,
				onToggleLayerVisibility: noopToggleLayerVisibility
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
