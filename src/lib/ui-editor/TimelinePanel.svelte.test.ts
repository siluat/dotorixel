// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/svelte';
import TimelinePanel from './TimelinePanel.svelte';

afterEach(() => {
	cleanup();
});

const noopAddLayer = () => {};
const noopAddReferenceLayer = () => {};
const noopActivateLayer = (_id: string) => {};
const noopRemoveLayer = (_id: string) => {};
const noopReorderLayer = (_id: string, _newVisualIndex: number) => {};
const noopToggleLayerVisibility = (_id: string, _visible: boolean) => {};
const noopToggleCollapsed = () => {};
const noopFitReferenceLayerToCanvas = (_id: string) => {};
const noopSelectFrame = (_id: string) => {};
const noopSelectCel = (_layerId: string, _frameId: string) => {};
const noopAddFrame = () => {};
const noopDuplicateFrame = () => {};
const noopRemoveFrame = (_id: string) => {};
const noopReorderFrame = (_id: string, _newIndex: number) => {};
const noopSetFrameDuration = (_id: string, _durationMs: number) => {};

const defaultProps = {
	collapsed: false,
	frames: [{ id: 'f1', occupiedLayerIds: new Set<string>(), durationMs: 100 }],
	activeFrameId: 'f1',
	onAddLayer: noopAddLayer,
	onAddReferenceLayer: noopAddReferenceLayer,
	onActivateLayer: noopActivateLayer,
	onRemoveLayer: noopRemoveLayer,
	onReorderLayer: noopReorderLayer,
	onToggleLayerVisibility: noopToggleLayerVisibility,
	onToggleCollapsed: noopToggleCollapsed,
	onFitReferenceLayerToCanvas: noopFitReferenceLayerToCanvas,
	onSelectFrame: noopSelectFrame,
	onSelectCel: noopSelectCel,
	onAddFrame: noopAddFrame,
	onDuplicateFrame: noopDuplicateFrame,
	onRemoveFrame: noopRemoveFrame,
	onReorderFrame: noopReorderFrame,
	onSetFrameDuration: noopSetFrameDuration
};

function pixelLayer(id: string, name: string, opts: { visible?: boolean } = {}) {
	return { id, name, kind: 'pixel' as const, ...opts };
}

function referenceLayer(id: string, name: string, opts: { visible?: boolean } = {}) {
	return { id, name, kind: 'reference' as const, ...opts };
}

function frame(id: string, occupied: ReadonlyArray<string> = [], durationMs = 100) {
	return { id, occupiedLayerIds: new Set(occupied), durationMs };
}

describe('TimelinePanel', () => {
	it('renders a single row showing the layer name when one layer is provided', () => {
		const layers = [pixelLayer('a', 'Layer 1')];
		const { container } = render(TimelinePanel, {
			props: { layers, activeLayerId: 'a', ...defaultProps }
		});

		const rows = container.querySelectorAll('[data-layer-row]');
		expect(rows.length).toBe(1);
		expect(rows[0].textContent).toContain('Layer 1');
	});

	it('renders one row per layer with each layer name visible', () => {
		const layers = [
			pixelLayer('a', 'Layer 1'),
			pixelLayer('b', 'Layer 2'),
			pixelLayer('c', 'Hair')
		];
		const { container } = render(TimelinePanel, {
			props: { layers, activeLayerId: 'a', ...defaultProps }
		});

		const rows = container.querySelectorAll('[data-layer-row]');
		expect(rows.length).toBe(3);
		const names = Array.from(rows).map((r) => r.querySelector('.name')?.textContent?.trim());
		expect(names).toEqual(expect.arrayContaining(['Layer 1', 'Layer 2', 'Hair']));
	});

	it('renders distinct kind icons for Pixel and Reference Layer rows', () => {
		const layers = [pixelLayer('paint', 'Paint'), referenceLayer('reference', 'Sketch reference')];
		const { container } = render(TimelinePanel, {
			props: { layers, activeLayerId: 'paint', ...defaultProps }
		});

		const paintRow = container.querySelector(
			'[data-layer-row][data-layer-id="paint"]'
		) as HTMLElement;
		const referenceRow = container.querySelector(
			'[data-layer-row][data-layer-id="reference"]'
		) as HTMLElement;

		expect(paintRow.querySelector('[data-layer-kind-icon]')?.getAttribute('data-layer-kind')).toBe(
			'pixel'
		);
		expect(paintRow.querySelector('[data-layer-kind-icon]')?.getAttribute('aria-label')).toBe(
			'Pixel Layer'
		);
		expect(
			referenceRow.querySelector('[data-layer-kind-icon]')?.getAttribute('data-layer-kind')
		).toBe('reference');
		expect(referenceRow.querySelector('[data-layer-kind-icon]')?.getAttribute('aria-label')).toBe(
			'Reference Layer'
		);
	});

	it('omits the reorder handle for the fixed-bottom Reference row and disables the sole Pixel handle', () => {
		const layers = [pixelLayer('paint', 'Paint'), referenceLayer('reference', 'Sketch reference')];
		const { container } = render(TimelinePanel, {
			props: { layers, activeLayerId: 'paint', ...defaultProps }
		});

		const paintRow = container.querySelector(
			'[data-layer-row][data-layer-id="paint"]'
		) as HTMLElement;
		const referenceRow = container.querySelector(
			'[data-layer-row][data-layer-id="reference"]'
		) as HTMLElement;

		const paintHandle = paintRow.querySelector('[data-reorder-handle]') as HTMLButtonElement;
		expect(paintHandle).not.toBeNull();
		expect(paintHandle.disabled).toBe(true);
		expect(referenceRow.querySelector('[data-reorder-handle]')).toBeNull();
	});

	it('marks the active layer row with aria-current and leaves others unmarked', () => {
		const layers = [
			pixelLayer('a', 'Layer 1'),
			pixelLayer('b', 'Layer 2'),
			pixelLayer('c', 'Layer 3')
		];
		const { container } = render(TimelinePanel, {
			props: { layers, activeLayerId: 'b', ...defaultProps }
		});

		const rowB = container.querySelector('[data-layer-row][data-layer-id="b"]');
		const rowA = container.querySelector('[data-layer-row][data-layer-id="a"]');
		const rowC = container.querySelector('[data-layer-row][data-layer-id="c"]');

		expect(rowB?.getAttribute('aria-current')).toBe('true');
		expect(rowA?.hasAttribute('aria-current')).toBe(false);
		expect(rowC?.hasAttribute('aria-current')).toBe(false);
	});

	it('renders an add-layer button in the header', () => {
		const layers = [pixelLayer('a', 'Layer 1')];
		const { container } = render(TimelinePanel, {
			props: { layers, activeLayerId: 'a', ...defaultProps }
		});

		const button = container.querySelector('[data-add-layer]');
		expect(button).not.toBeNull();
		expect(button?.tagName).toBe('BUTTON');
	});

	it('invokes onAddLayer when the add-layer button is clicked', async () => {
		const layers = [pixelLayer('a', 'Layer 1')];
		const onAddLayer = vi.fn();
		const { container } = render(TimelinePanel, {
			props: { layers, activeLayerId: 'a', ...defaultProps, onAddLayer }
		});

		const button = container.querySelector('[data-add-layer]') as HTMLButtonElement;
		await fireEvent.click(button);

		expect(onAddLayer).toHaveBeenCalledTimes(1);
	});

	it('renders a Reference Layer import button beside the Pixel add button', () => {
		const layers = [pixelLayer('a', 'Layer 1')];
		const { container } = render(TimelinePanel, {
			props: { layers, activeLayerId: 'a', ...defaultProps }
		});

		const pixelButton = container.querySelector('[data-add-layer]');
		const referenceButton = container.querySelector('[data-add-reference-layer]');
		expect(pixelButton).not.toBeNull();
		expect(referenceButton).not.toBeNull();
		expect(referenceButton?.getAttribute('aria-label')).toBe('Set Reference Layer');
	});

	it('invokes onAddReferenceLayer when the Reference import button is clicked', async () => {
		const layers = [pixelLayer('a', 'Layer 1')];
		const onAddReferenceLayer = vi.fn();
		const { container } = render(TimelinePanel, {
			props: { layers, activeLayerId: 'a', ...defaultProps, onAddReferenceLayer }
		});

		const button = container.querySelector('[data-add-reference-layer]') as HTMLButtonElement;
		await fireEvent.click(button);

		expect(onAddReferenceLayer).toHaveBeenCalledTimes(1);
	});

	it('shows a busy Reference row and disables the import button during Reference import', () => {
		const layers = [pixelLayer('paint', 'Paint'), referenceLayer('reference', 'Old reference')];
		const { container } = render(TimelinePanel, {
			props: {
				layers,
				activeLayerId: 'paint',
				...defaultProps,
				isReferenceLayerImporting: true,
				referenceLayerImportName: 'sketch.png'
			}
		});

		const button = container.querySelector('[data-add-reference-layer]') as HTMLButtonElement;
		expect(button.disabled).toBe(true);
		expect(button.getAttribute('data-busy')).toBe('true');

		expect(container.querySelector('[data-layer-row][data-layer-id="reference"]')).toBeNull();
		const busyRow = container.querySelector('[data-reference-layer-import-row]');
		expect(busyRow).not.toBeNull();
		expect(busyRow?.getAttribute('aria-busy')).toBe('true');
		expect(busyRow?.textContent).toContain('sketch.png');
		expect(busyRow?.querySelector('[data-remove-layer]')).toBeNull();
		expect(busyRow?.querySelector('[data-reorder-handle]')).toBeNull();
	});

	it('invokes onActivateLayer with the layer id when a non-active row is clicked', async () => {
		const layers = [
			pixelLayer('a', 'Layer 1'),
			pixelLayer('b', 'Layer 2')
		];
		const onActivateLayer = vi.fn();
		const { container } = render(TimelinePanel, {
			props: { layers, activeLayerId: 'a', ...defaultProps, onActivateLayer }
		});

		const rowB = container.querySelector('[data-layer-row][data-layer-id="b"]') as HTMLElement;
		await fireEvent.click(rowB);

		expect(onActivateLayer).toHaveBeenCalledWith('b');
		expect(onActivateLayer).toHaveBeenCalledTimes(1);
	});

	it('invokes onActivateLayer when a Reference Layer row is clicked', async () => {
		const layers = [
			pixelLayer('paint', 'Paint'),
			{ id: 'reference', name: 'Sketch reference', kind: 'reference' as const }
		];
		const onActivateLayer = vi.fn();
		const { container } = render(TimelinePanel, {
			props: { layers, activeLayerId: 'paint', ...defaultProps, onActivateLayer }
		});

		const referenceRow = container.querySelector(
			'[data-layer-row][data-layer-id="reference"]'
		) as HTMLElement;
		await fireEvent.click(referenceRow);

		expect(onActivateLayer).toHaveBeenCalledWith('reference');
		expect(onActivateLayer).toHaveBeenCalledTimes(1);
	});

	it('shows the fit-to-canvas action only on the active Reference Layer row', () => {
		const layers = [
			pixelLayer('paint', 'Paint'),
			referenceLayer('reference', 'Sketch reference')
		];
		const { container } = render(TimelinePanel, {
			props: { layers, activeLayerId: 'reference', ...defaultProps }
		});

		const paintRow = container.querySelector(
			'[data-layer-row][data-layer-id="paint"]'
		) as HTMLElement;
		const referenceRow = container.querySelector(
			'[data-layer-row][data-layer-id="reference"]'
		) as HTMLElement;

		expect(paintRow.querySelector('[data-fit-reference-layer-to-canvas]')).toBeNull();
		const fitButton = referenceRow.querySelector(
			'[data-fit-reference-layer-to-canvas]'
		) as HTMLButtonElement;
		expect(fitButton).not.toBeNull();
		expect(fitButton.getAttribute('aria-label')).toBe('Fit Sketch reference to canvas');
	});

	it('hides the fit-to-canvas action when the Reference Layer row is inactive', () => {
		const layers = [
			pixelLayer('paint', 'Paint'),
			referenceLayer('reference', 'Sketch reference')
		];
		const { container } = render(TimelinePanel, {
			props: { layers, activeLayerId: 'paint', ...defaultProps }
		});

		const referenceRow = container.querySelector(
			'[data-layer-row][data-layer-id="reference"]'
		) as HTMLElement;
		expect(referenceRow.querySelector('[data-fit-reference-layer-to-canvas]')).toBeNull();
	});

	it('invokes fit-to-canvas without activating the row again', async () => {
		const layers = [
			pixelLayer('paint', 'Paint'),
			referenceLayer('reference', 'Sketch reference')
		];
		const onActivateLayer = vi.fn();
		const onFitReferenceLayerToCanvas = vi.fn();
		const { container } = render(TimelinePanel, {
			props: {
				layers,
				activeLayerId: 'reference',
				...defaultProps,
				onActivateLayer,
				onFitReferenceLayerToCanvas
			}
		});

		const fitButton = container.querySelector(
			'[data-layer-row][data-layer-id="reference"] [data-fit-reference-layer-to-canvas]'
		) as HTMLButtonElement;
		await fireEvent.click(fitButton);

		expect(onFitReferenceLayerToCanvas).toHaveBeenCalledWith('reference');
		expect(onFitReferenceLayerToCanvas).toHaveBeenCalledTimes(1);
		expect(onActivateLayer).not.toHaveBeenCalled();
	});

	it('renders a remove affordance on every layer row', () => {
		const layers = [
			pixelLayer('a', 'Layer 1'),
			pixelLayer('b', 'Layer 2'),
			pixelLayer('c', 'Layer 3')
		];
		const { container } = render(TimelinePanel, {
			props: { layers, activeLayerId: 'a', ...defaultProps }
		});

		const removeButtons = container.querySelectorAll('[data-remove-layer]');
		expect(removeButtons.length).toBe(3);
		for (const btn of removeButtons) {
			expect(btn.tagName).toBe('BUTTON');
		}
	});

	it('invokes onRemoveLayer with that row’s layer id when its remove button is clicked', async () => {
		const layers = [
			pixelLayer('a', 'Layer 1'),
			pixelLayer('b', 'Layer 2')
		];
		const onRemoveLayer = vi.fn();
		const { container } = render(TimelinePanel, {
			props: { layers, activeLayerId: 'a', ...defaultProps, onRemoveLayer }
		});

		const rowB = container.querySelector('[data-layer-row][data-layer-id="b"]') as HTMLElement;
		const btn = rowB.querySelector('[data-remove-layer]') as HTMLButtonElement;
		await fireEvent.click(btn);

		expect(onRemoveLayer).toHaveBeenCalledWith('b');
		expect(onRemoveLayer).toHaveBeenCalledTimes(1);
	});

	it('clicking the remove button does not also activate that row', async () => {
		const layers = [
			pixelLayer('a', 'Layer 1'),
			pixelLayer('b', 'Layer 2')
		];
		const onActivateLayer = vi.fn();
		const { container } = render(TimelinePanel, {
			props: { layers, activeLayerId: 'a', ...defaultProps, onActivateLayer }
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
			pixelLayer('a', 'Layer 1'),
			pixelLayer('b', 'Layer 2')
		];
		const onActivateLayer = vi.fn();
		const { container } = render(TimelinePanel, {
			props: { layers, activeLayerId: 'a', ...defaultProps, onActivateLayer }
		});

		const rowB = container.querySelector('[data-layer-row][data-layer-id="b"]') as HTMLElement;
		const btn = rowB.querySelector('[data-remove-layer]') as HTMLButtonElement;
		btn.focus();
		await fireEvent.keyDown(btn, { key });

		expect(onActivateLayer).not.toHaveBeenCalled();
	});

	it('disables the remove button when only one layer remains', () => {
		const layers = [pixelLayer('a', 'Layer 1')];
		const { container } = render(TimelinePanel, {
			props: { layers, activeLayerId: 'a', ...defaultProps }
		});

		const btn = container.querySelector('[data-remove-layer]') as HTMLButtonElement;
		expect(btn.disabled).toBe(true);
	});

	it('enables the remove button on every row when two or more layers are present', () => {
		const layers = [
			pixelLayer('a', 'Layer 1'),
			pixelLayer('b', 'Layer 2')
		];
		const { container } = render(TimelinePanel, {
			props: { layers, activeLayerId: 'a', ...defaultProps }
		});

		const btns = container.querySelectorAll<HTMLButtonElement>('[data-remove-layer]');
		expect(btns.length).toBe(2);
		for (const b of btns) expect(b.disabled).toBe(false);
	});

	it('renders a reorder handle on every Pixel Layer row', () => {
		const layers = [
			pixelLayer('a', 'Layer 1'),
			pixelLayer('b', 'Layer 2'),
			pixelLayer('c', 'Layer 3')
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
		const layers = [pixelLayer('a', 'Layer 1')];
		const { container } = render(TimelinePanel, {
			props: { layers, activeLayerId: 'a', ...defaultProps }
		});

		const handle = container.querySelector('[data-reorder-handle]') as HTMLButtonElement;
		expect(handle.disabled).toBe(true);
	});

	it('enables the reorder handle on every Pixel row when two or more Pixel Layers are present', () => {
		const layers = [
			pixelLayer('a', 'Layer 1'),
			pixelLayer('b', 'Layer 2')
		];
		const { container } = render(TimelinePanel, {
			props: { layers, activeLayerId: 'a', ...defaultProps }
		});

		const handles = container.querySelectorAll<HTMLButtonElement>('[data-reorder-handle]');
		for (const h of handles) expect(h.disabled).toBe(false);
	});

	it('clicking the reorder handle does not activate the row', async () => {
		const layers = [
			pixelLayer('a', 'Layer 1'),
			pixelLayer('b', 'Layer 2')
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
			pixelLayer('a', 'Layer 1'),
			pixelLayer('b', 'Layer 2')
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

	// Adapter wiring smokes: the drag/keyboard reorder *behavior* suite lives
	// headlessly in src/lib/gestures/reorder-interaction.svelte.test.ts (issue
	// 212). These only verify TimelinePanel routes events, drop callbacks, and
	// preview style vars through its two Reorder Interaction instances.
	it('routes ArrowUp on a reorder handle through the module to onReorderLayer', async () => {
		// Panel order (top→bottom): [Layer 3 (id c), Layer 2 (id b), Layer 1 (id a)]
		const layers = [
			pixelLayer('c', 'Layer 3'),
			pixelLayer('b', 'Layer 2'),
			pixelLayer('a', 'Layer 1')
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

	it('pointer-dragging row C downward by two row-heights and releasing calls onReorderLayer with the dropped visual index', async () => {
		const layers = [
			pixelLayer('c', 'Layer 3'),
			pixelLayer('b', 'Layer 2'),
			pixelLayer('a', 'Layer 1')
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

	it('pointer-dragging previews the moving row and displaced rows before release', async () => {
		const layers = [
			pixelLayer('c', 'Layer 3'),
			pixelLayer('b', 'Layer 2'),
			pixelLayer('a', 'Layer 1')
		];
		const onReorderLayer = vi.fn();
		const { container } = render(TimelinePanel, {
			props: { layers, activeLayerId: 'a', ...defaultProps, onReorderLayer }
		});

		const rowC = container.querySelector('[data-layer-row][data-layer-id="c"]') as HTMLElement;
		const rowB = container.querySelector('[data-layer-row][data-layer-id="b"]') as HTMLElement;
		const rowA = container.querySelector('[data-layer-row][data-layer-id="a"]') as HTMLElement;
		const handleC = rowC.querySelector('[data-reorder-handle]') as HTMLButtonElement;

		await fireEvent.pointerDown(handleC, { clientY: 0, pointerId: 1 });

		expect(rowC.getAttribute('data-dragging')).toBe('true');
		expect(rowC.hasAttribute('data-drag-target')).toBe(false);

		await fireEvent.pointerMove(handleC, { clientY: 64, pointerId: 1 });

		expect(rowC.getAttribute('data-dragging')).toBe('true');
		expect(rowA.getAttribute('data-drag-target')).toBe('true');
		expect(rowC.style.getPropertyValue('--layer-drag-y')).toBe('64px');
		expect(rowB.style.getPropertyValue('--layer-drag-y')).toBe('-32px');
		expect(rowA.style.getPropertyValue('--layer-drag-y')).toBe('-32px');
		expect(onReorderLayer).not.toHaveBeenCalled();
	});

	it('renders a visibility toggle on every layer row', () => {
		const layers = [
			pixelLayer('a', 'Layer 1'),
			pixelLayer('b', 'Layer 2'),
			pixelLayer('c', 'Layer 3')
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
			pixelLayer('a', 'Layer 1', { visible: true }),
			pixelLayer('b', 'Layer 2', { visible: true })
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
			pixelLayer('a', 'Layer 1', { visible: true }),
			pixelLayer('b', 'Layer 2', { visible: false })
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
			pixelLayer('a', 'Layer 1'),
			pixelLayer('b', 'Layer 2')
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
			pixelLayer('a', 'Layer 1'),
			pixelLayer('b', 'Layer 2')
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
			pixelLayer('a', 'Layer 1', { visible: true }),
			pixelLayer('b', 'Layer 2', { visible: false })
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
			pixelLayer('a', 'Layer 1', { visible: true }),
			pixelLayer('b', 'Layer 2', { visible: false })
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
		const layers = [pixelLayer('a', 'Layer 1')];
		const { container } = render(TimelinePanel, {
			props: { layers, activeLayerId: 'a', ...defaultProps }
		});

		const toggle = container.querySelector('[data-collapse-toggle]');
		expect(toggle).not.toBeNull();
		expect(toggle?.tagName).toBe('BUTTON');
	});

	it('renders expanded when collapsed=false', () => {
		const layers = [pixelLayer('a', 'Layer 1')];
		const { container } = render(TimelinePanel, {
			props: { layers, activeLayerId: 'a', ...defaultProps, collapsed: false }
		});

		const panel = container.querySelector('.timeline-panel') as HTMLElement;
		expect(panel.getAttribute('data-collapsed')).toBe('false');
	});

	it('renders collapsed when collapsed=true', () => {
		const layers = [pixelLayer('a', 'Layer 1')];
		const { container } = render(TimelinePanel, {
			props: { layers, activeLayerId: 'a', ...defaultProps, collapsed: true }
		});

		const panel = container.querySelector('.timeline-panel') as HTMLElement;
		expect(panel.getAttribute('data-collapsed')).toBe('true');
	});

	it('calls onToggleCollapsed when the collapse toggle is clicked', async () => {
		const onToggleCollapsed = vi.fn();
		const layers = [pixelLayer('a', 'Layer 1')];
		const { container } = render(TimelinePanel, {
			props: { layers, activeLayerId: 'a', ...defaultProps, onToggleCollapsed }
		});

		const toggle = container.querySelector('[data-collapse-toggle]') as HTMLButtonElement;
		await fireEvent.click(toggle);

		expect(onToggleCollapsed).toHaveBeenCalledTimes(1);
	});

	it('does not internally update collapsed when the toggle is clicked (controlled component)', async () => {
		const layers = [pixelLayer('a', 'Layer 1')];
		const { container } = render(TimelinePanel, {
			props: { layers, activeLayerId: 'a', ...defaultProps, collapsed: false }
		});

		const toggle = container.querySelector('[data-collapse-toggle]') as HTMLButtonElement;
		await fireEvent.click(toggle);

		// Without the parent flipping the prop, the panel stays expanded — the
		// click only signals intent.
		const panel = container.querySelector('.timeline-panel') as HTMLElement;
		expect(panel.getAttribute('data-collapsed')).toBe('false');
	});

	it('shows the active layer name in the header when collapsed=true', () => {
		const layers = [
			pixelLayer('a', 'Sky'),
			pixelLayer('b', 'Mountains')
		];
		const { container } = render(TimelinePanel, {
			props: { layers, activeLayerId: 'b', ...defaultProps, collapsed: true }
		});

		const header = container.querySelector('.timeline-panel .header') as HTMLElement;
		expect(header.textContent).toContain('Mountains');
	});

	it('does not render the layer rows when collapsed=true', () => {
		const layers = [
			pixelLayer('a', 'Layer 1'),
			pixelLayer('b', 'Layer 2')
		];
		const { container } = render(TimelinePanel, {
			props: { layers, activeLayerId: 'a', ...defaultProps, collapsed: true }
		});

		const rows = container.querySelectorAll('[data-layer-row]');
		expect(rows.length).toBe(0);
	});

	it('hides the add-layer and add-reference actions when collapsed (read-only strip)', () => {
		const layers = [pixelLayer('a', 'Layer 1')];
		const { container } = render(TimelinePanel, {
			props: { layers, activeLayerId: 'a', ...defaultProps, collapsed: true }
		});

		expect(container.querySelector('[data-add-layer]')).toBeNull();
		expect(container.querySelector('[data-add-reference-layer]')).toBeNull();
		// The collapse chevron stays so the strip can be expanded again.
		expect(container.querySelector('[data-collapse-toggle]')).not.toBeNull();
	});

	it('switches the collapse toggle aria-label between Collapse and Expand by prop', () => {
		const layers = [pixelLayer('a', 'Layer 1')];
		const { container: expandedContainer } = render(TimelinePanel, {
			props: { layers, activeLayerId: 'a', ...defaultProps, collapsed: false }
		});
		const expandedToggle = expandedContainer.querySelector(
			'[data-collapse-toggle]'
		) as HTMLButtonElement;
		expect(expandedToggle.getAttribute('aria-label')).toMatch(/collapse/i);

		const { container: collapsedContainer } = render(TimelinePanel, {
			props: { layers, activeLayerId: 'a', ...defaultProps, collapsed: true }
		});
		const collapsedToggle = collapsedContainer.querySelector(
			'[data-collapse-toggle]'
		) as HTMLButtonElement;
		expect(collapsedToggle.getAttribute('aria-label')).toMatch(/expand/i);
	});

	it('reflects the collapsed prop via aria-expanded on the collapse toggle', () => {
		const layers = [pixelLayer('a', 'Layer 1')];
		const { container: expandedContainer } = render(TimelinePanel, {
			props: { layers, activeLayerId: 'a', ...defaultProps, collapsed: false }
		});
		expect(
			expandedContainer
				.querySelector('[data-collapse-toggle]')
				?.getAttribute('aria-expanded')
		).toBe('true');

		const { container: collapsedContainer } = render(TimelinePanel, {
			props: { layers, activeLayerId: 'a', ...defaultProps, collapsed: true }
		});
		expect(
			collapsedContainer
				.querySelector('[data-collapse-toggle]')
				?.getAttribute('aria-expanded')
		).toBe('false');
	});

	it('activates the row when Enter or Space is pressed on a focused row', async () => {
		const layers = [
			pixelLayer('a', 'Layer 1'),
			pixelLayer('b', 'Layer 2')
		];
		const onActivateLayer = vi.fn();
		const { container } = render(TimelinePanel, {
			props: { layers, activeLayerId: 'a', ...defaultProps, onActivateLayer }
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

	it('renders one ruler column per frame with 1-based ordinals', () => {
		const layers = [pixelLayer('a', 'Layer 1')];
		const frames = [frame('f1'), frame('f2'), frame('f3')];
		const { container } = render(TimelinePanel, {
			props: { layers, activeLayerId: 'a', ...defaultProps, frames, activeFrameId: 'f1' }
		});

		const cells = container.querySelectorAll('[data-frame-ruler-cell]');
		expect(cells.length).toBe(3);
		expect(Array.from(cells).map((c) => c.textContent?.trim())).toEqual(['1', '2', '3']);
	});

	it('renders a dot for a content-bearing cel and leaves an empty cel blank', () => {
		const layers = [pixelLayer('a', 'Layer 1'), pixelLayer('b', 'Layer 2')];
		const frames = [frame('f1', ['a']), frame('f2')];
		const { container } = render(TimelinePanel, {
			props: { layers, activeLayerId: 'a', ...defaultProps, frames, activeFrameId: 'f1' }
		});

		const cell = (layerId: string, frameId: string) =>
			container.querySelector(
				`[data-frame-cell][data-layer-id="${layerId}"][data-frame-id="${frameId}"]`
			);

		// Layer a is occupied in f1 → dot; empty in f2 → blank. Layer b is empty in f1.
		expect(cell('a', 'f1')?.querySelector('[data-cel-dot]')).not.toBeNull();
		expect(cell('a', 'f2')?.querySelector('[data-cel-dot]')).toBeNull();
		expect(cell('b', 'f1')?.querySelector('[data-cel-dot]')).toBeNull();
	});

	it('renders the Reference Layer as a single continuous spanning bar, not per-frame cells', () => {
		const layers = [pixelLayer('a', 'Layer 1'), referenceLayer('ref', 'Sketch reference')];
		const frames = [frame('f1'), frame('f2'), frame('f3')];
		const { container } = render(TimelinePanel, {
			props: { layers, activeLayerId: 'a', ...defaultProps, frames, activeFrameId: 'f1' }
		});

		// One spanning bar for the Reference row...
		const bars = container.querySelectorAll('[data-frame-reference-span]');
		expect(bars.length).toBe(1);
		// ...and no discrete per-frame cells for the Reference Layer.
		expect(container.querySelectorAll('[data-frame-cell][data-layer-id="ref"]').length).toBe(0);
		// Pixel rows still render their per-frame cells.
		expect(container.querySelectorAll('[data-frame-cell][data-layer-id="a"]').length).toBe(3);
	});

	it('highlights the active frame column (aria-current + active marker) and the active cel', () => {
		const layers = [pixelLayer('a', 'Layer 1'), pixelLayer('b', 'Layer 2')];
		const frames = [frame('f1'), frame('f2')];
		const { container } = render(TimelinePanel, {
			props: { layers, activeLayerId: 'a', ...defaultProps, frames, activeFrameId: 'f2' }
		});

		const ruler = (frameId: string) =>
			container.querySelector(`[data-frame-ruler-cell][data-frame-id="${frameId}"]`);
		const cell = (layerId: string, frameId: string) =>
			container.querySelector(
				`[data-frame-cell][data-layer-id="${layerId}"][data-frame-id="${frameId}"]`
			);

		// Channel 1+2 anchor: the active ruler cell announces itself to assistive tech.
		expect(ruler('f2')?.getAttribute('aria-current')).toBe('true');
		expect(ruler('f1')?.hasAttribute('aria-current')).toBe(false);

		// The whole active column is marked; inactive columns are not.
		expect(cell('a', 'f2')?.getAttribute('data-frame-active')).toBe('true');
		expect(cell('b', 'f2')?.getAttribute('data-frame-active')).toBe('true');
		expect(cell('a', 'f1')?.hasAttribute('data-frame-active')).toBe(false);

		// The active cel = active layer (a) ∩ active frame (f2) gets combined emphasis.
		expect(cell('a', 'f2')?.getAttribute('data-cel-active')).toBe('true');
		expect(cell('b', 'f2')?.hasAttribute('data-cel-active')).toBe(false);
	});

	it('clicking a ruler ordinal selects the frame only — never a cel', async () => {
		const layers = [pixelLayer('a', 'Layer 1')];
		const frames = [frame('f1'), frame('f2')];
		const onSelectFrame = vi.fn();
		const onSelectCel = vi.fn();
		const { container } = render(TimelinePanel, {
			props: {
				layers,
				activeLayerId: 'a',
				...defaultProps,
				frames,
				activeFrameId: 'f1',
				onSelectFrame,
				onSelectCel
			}
		});

		const rulerF2 = container.querySelector(
			'[data-frame-ruler-cell][data-frame-id="f2"]'
		) as HTMLElement;
		await fireEvent.click(rulerF2);

		expect(onSelectFrame).toHaveBeenCalledWith('f2');
		expect(onSelectFrame).toHaveBeenCalledTimes(1);
		expect(onSelectCel).not.toHaveBeenCalled();
	});

	it('clicking a grid cell selects both the layer and the frame of that cel', async () => {
		const layers = [pixelLayer('a', 'Layer 1'), pixelLayer('b', 'Layer 2')];
		const frames = [frame('f1'), frame('f2')];
		const onSelectFrame = vi.fn();
		const onSelectCel = vi.fn();
		const { container } = render(TimelinePanel, {
			props: {
				layers,
				activeLayerId: 'a',
				...defaultProps,
				frames,
				activeFrameId: 'f1',
				onSelectFrame,
				onSelectCel
			}
		});

		const cellB2 = container.querySelector(
			'[data-frame-cell][data-layer-id="b"][data-frame-id="f2"]'
		) as HTMLElement;
		await fireEvent.click(cellB2);

		expect(onSelectCel).toHaveBeenCalledWith('b', 'f2');
		expect(onSelectCel).toHaveBeenCalledTimes(1);
	});

	it('shows the active layer and "Frame n/N" in the collapsed summary', () => {
		const layers = [pixelLayer('a', 'Sky'), pixelLayer('b', 'Mountains')];
		const frames = [frame('f1'), frame('f2'), frame('f3')];
		const { container } = render(TimelinePanel, {
			props: {
				layers,
				activeLayerId: 'b',
				...defaultProps,
				collapsed: true,
				frames,
				activeFrameId: 'f2'
			}
		});

		const header = container.querySelector('.timeline-panel .header') as HTMLElement;
		expect(header.textContent).toContain('Mountains');
		// Active frame f2 is the 2nd of 3 frames (187 spec format: "Frame n / N").
		expect(header.textContent).toContain('2 / 3');
	});

	it('captions the Reference spanning bar as the underlay shared across frames', () => {
		const layers = [pixelLayer('a', 'Layer 1'), referenceLayer('ref', 'Sketch reference')];
		const frames = [frame('f1'), frame('f2')];
		const { container } = render(TimelinePanel, {
			props: { layers, activeLayerId: 'a', ...defaultProps, frames, activeFrameId: 'f1' }
		});

		const bar = container.querySelector('[data-frame-reference-span]') as HTMLElement;
		expect(bar.textContent).toContain('underlay — same under every frame');
	});

	it('gives ruler ordinal and grid cell buttons descriptive accessible names', () => {
		const layers = [pixelLayer('a', 'Sky')];
		const frames = [frame('f1'), frame('f2')];
		const { container } = render(TimelinePanel, {
			props: { layers, activeLayerId: 'a', ...defaultProps, frames, activeFrameId: 'f1' }
		});

		const ruler2 = container.querySelector('[data-frame-ruler-cell][data-frame-id="f2"]');
		expect(ruler2?.getAttribute('aria-label')).toBe('Select frame 2');

		const cell = container.querySelector(
			'[data-frame-cell][data-layer-id="a"][data-frame-id="f2"]'
		);
		expect(cell?.getAttribute('aria-label')).toBe('Select Sky, frame 2');
	});

	it('tints the active layer row across the frame grid, not only the sidebar', () => {
		const layers = [pixelLayer('a', 'Layer 1'), pixelLayer('b', 'Layer 2')];
		const frames = [frame('f1')];
		const { container } = render(TimelinePanel, {
			props: { layers, activeLayerId: 'b', ...defaultProps, frames, activeFrameId: 'f1' }
		});

		const gridRow = (id: string) =>
			container.querySelector(`[data-frame-row][data-layer-id="${id}"]`);
		expect(gridRow('b')?.classList.contains('frame-row--active-layer')).toBe(true);
		expect(gridRow('a')?.classList.contains('frame-row--active-layer')).toBe(false);
	});

	describe('frame operations (add / duplicate / delete / reorder)', () => {
		it('renders a Frames label and an add-frame button in the header', () => {
			const layers = [pixelLayer('a', 'Layer 1')];
			const { container } = render(TimelinePanel, {
				props: { layers, activeLayerId: 'a', ...defaultProps }
			});

			// The right-side group is labeled "Frames", mirroring the left "Layers"
			// label to disambiguate the two + buttons (187 spec §3).
			const header = container.querySelector('.timeline-panel .header') as HTMLElement;
			expect(header.textContent).toContain('Frames');

			const addFrame = container.querySelector('[data-add-frame]');
			expect(addFrame).not.toBeNull();
			expect(addFrame?.tagName).toBe('BUTTON');
		});

		it('invokes onAddFrame when the add-frame button is clicked', async () => {
			const layers = [pixelLayer('a', 'Layer 1')];
			const onAddFrame = vi.fn();
			const { container } = render(TimelinePanel, {
				props: { layers, activeLayerId: 'a', ...defaultProps, onAddFrame }
			});

			const btn = container.querySelector('[data-add-frame]') as HTMLButtonElement;
			await fireEvent.click(btn);

			expect(onAddFrame).toHaveBeenCalledTimes(1);
		});

		it('renders a duplicate-frame button and invokes onDuplicateFrame on click', async () => {
			const layers = [pixelLayer('a', 'Layer 1')];
			const onDuplicateFrame = vi.fn();
			const { container } = render(TimelinePanel, {
				props: { layers, activeLayerId: 'a', ...defaultProps, onDuplicateFrame }
			});

			const btn = container.querySelector('[data-duplicate-frame]') as HTMLButtonElement;
			expect(btn).not.toBeNull();
			expect(btn.tagName).toBe('BUTTON');

			await fireEvent.click(btn);

			expect(onDuplicateFrame).toHaveBeenCalledTimes(1);
		});

		it('renders a delete-frame button and invokes onRemoveFrame with the active frame id', async () => {
			const layers = [pixelLayer('a', 'Layer 1')];
			const frames = [frame('f1'), frame('f2')];
			const onRemoveFrame = vi.fn();
			const { container } = render(TimelinePanel, {
				props: {
					layers,
					activeLayerId: 'a',
					...defaultProps,
					frames,
					activeFrameId: 'f2',
					onRemoveFrame
				}
			});

			const btn = container.querySelector('[data-remove-frame]') as HTMLButtonElement;
			expect(btn).not.toBeNull();

			await fireEvent.click(btn);

			// The header delete acts on the active frame (f2 here), mirroring how
			// add/duplicate target the active frame in the core.
			expect(onRemoveFrame).toHaveBeenCalledWith('f2');
			expect(onRemoveFrame).toHaveBeenCalledTimes(1);
		});

		it('disables the delete-frame button when only one frame remains', () => {
			const layers = [pixelLayer('a', 'Layer 1')];
			const frames = [frame('f1')];
			const { container } = render(TimelinePanel, {
				props: { layers, activeLayerId: 'a', ...defaultProps, frames, activeFrameId: 'f1' }
			});

			const btn = container.querySelector('[data-remove-frame]') as HTMLButtonElement;
			expect(btn.disabled).toBe(true);
		});

		it('enables the delete-frame button when two or more frames are present', () => {
			const layers = [pixelLayer('a', 'Layer 1')];
			const frames = [frame('f1'), frame('f2')];
			const { container } = render(TimelinePanel, {
				props: { layers, activeLayerId: 'a', ...defaultProps, frames, activeFrameId: 'f1' }
			});

			const btn = container.querySelector('[data-remove-frame]') as HTMLButtonElement;
			expect(btn.disabled).toBe(false);
		});

		it('hides the frame-action group and Frames label when collapsed (read-only strip)', () => {
			const layers = [pixelLayer('a', 'Layer 1')];
			const { container } = render(TimelinePanel, {
				props: { layers, activeLayerId: 'a', ...defaultProps, collapsed: true }
			});

			expect(container.querySelector('[data-frames-label]')).toBeNull();
			expect(container.querySelector('[data-add-frame]')).toBeNull();
			expect(container.querySelector('[data-duplicate-frame]')).toBeNull();
			expect(container.querySelector('[data-remove-frame]')).toBeNull();
			// The collapse chevron stays so the strip can be expanded again.
			expect(container.querySelector('[data-collapse-toggle]')).not.toBeNull();
		});

		const rulerCell = (container: HTMLElement, frameId: string) =>
			container.querySelector(
				`[data-frame-ruler-cell][data-frame-id="${frameId}"]`
			) as HTMLElement;

		// Adapter wiring smokes (tap-select vs drag-commit pair) — the full ruler
		// drag/tap behavior suite lives headlessly in
		// src/lib/gestures/reorder-interaction.svelte.test.ts (issue 212).
		it('does not also select the frame after a completed drag (trailing click swallowed)', async () => {
			const layers = [pixelLayer('a', 'Layer 1')];
			const frames = [frame('f1'), frame('f2'), frame('f3')];
			const onSelectFrame = vi.fn();
			const onReorderFrame = vi.fn();
			const { container } = render(TimelinePanel, {
				props: {
					layers,
					activeLayerId: 'a',
					...defaultProps,
					frames,
					activeFrameId: 'f1',
					onSelectFrame,
					onReorderFrame
				}
			});

			const f1 = rulerCell(container, 'f1');
			await fireEvent.pointerDown(f1, { clientX: 0, pointerId: 1 });
			await fireEvent.pointerMove(f1, { clientX: 64, pointerId: 1 });
			await fireEvent.pointerUp(f1, { clientX: 64, pointerId: 1 });
			// The browser emits a *pointer* click (detail > 0) after this sequence;
			// reordering must not also re-select the dragged frame.
			await fireEvent.click(f1, { detail: 1 });

			expect(onReorderFrame).toHaveBeenCalledWith('f1', 2);
			expect(onSelectFrame).not.toHaveBeenCalled();
		});

		it('still selects the frame on a tap (pointer down/up without movement)', async () => {
			const layers = [pixelLayer('a', 'Layer 1')];
			const frames = [frame('f1'), frame('f2')];
			const onSelectFrame = vi.fn();
			const onReorderFrame = vi.fn();
			const { container } = render(TimelinePanel, {
				props: {
					layers,
					activeLayerId: 'a',
					...defaultProps,
					frames,
					activeFrameId: 'f1',
					onSelectFrame,
					onReorderFrame
				}
			});

			const f2 = rulerCell(container, 'f2');
			await fireEvent.pointerDown(f2, { clientX: 40, pointerId: 1 });
			await fireEvent.pointerUp(f2, { clientX: 40, pointerId: 1 });
			await fireEvent.click(f2);

			expect(onSelectFrame).toHaveBeenCalledWith('f2');
			expect(onReorderFrame).not.toHaveBeenCalled();
		});

	});

	describe('frame duration control', () => {
		const durationInput = (container: HTMLElement) =>
			container.querySelector('[data-frame-duration-input]') as HTMLInputElement;

		it("shows the active frame's duration in an editable corner control", () => {
			const layers = [pixelLayer('a', 'Layer 1')];
			const frames = [frame('f1', [], 250), frame('f2', [], 100)];
			const { container } = render(TimelinePanel, {
				props: { layers, activeLayerId: 'a', ...defaultProps, frames, activeFrameId: 'f1' }
			});

			const input = durationInput(container);
			expect(input).not.toBeNull();
			expect(input.value).toBe('250');
		});

		it('updates the displayed duration when the active frame changes', async () => {
			const layers = [pixelLayer('a', 'Layer 1')];
			const frames = [frame('f1', [], 250), frame('f2', [], 80)];
			const { container, rerender } = render(TimelinePanel, {
				props: { layers, activeLayerId: 'a', ...defaultProps, frames, activeFrameId: 'f1' }
			});
			expect(durationInput(container).value).toBe('250');

			await rerender({ layers, activeLayerId: 'a', ...defaultProps, frames, activeFrameId: 'f2' });
			expect(durationInput(container).value).toBe('80');
		});

		it('commits a new duration with Enter, firing onSetFrameDuration with the active frame id', async () => {
			const layers = [pixelLayer('a', 'Layer 1')];
			const frames = [frame('f1', [], 100), frame('f2', [], 100)];
			const onSetFrameDuration = vi.fn();
			const { container } = render(TimelinePanel, {
				props: {
					layers,
					activeLayerId: 'a',
					...defaultProps,
					frames,
					activeFrameId: 'f2',
					onSetFrameDuration
				}
			});

			const input = durationInput(container);
			await fireEvent.input(input, { target: { value: '250' } });
			await fireEvent.keyDown(input, { key: 'Enter' });

			expect(onSetFrameDuration).toHaveBeenCalledWith('f2', 250);
			expect(onSetFrameDuration).toHaveBeenCalledTimes(1);
		});

		it('commits a new duration on blur', async () => {
			const layers = [pixelLayer('a', 'Layer 1')];
			const frames = [frame('f1', [], 100)];
			const onSetFrameDuration = vi.fn();
			const { container } = render(TimelinePanel, {
				props: {
					layers,
					activeLayerId: 'a',
					...defaultProps,
					frames,
					activeFrameId: 'f1',
					onSetFrameDuration
				}
			});

			const input = durationInput(container);
			await fireEvent.input(input, { target: { value: '400' } });
			await fireEvent.blur(input);

			expect(onSetFrameDuration).toHaveBeenCalledWith('f1', 400);
			expect(onSetFrameDuration).toHaveBeenCalledTimes(1);
		});

		it('reverts an emptied field to the prior value without firing', async () => {
			const layers = [pixelLayer('a', 'Layer 1')];
			const frames = [frame('f1', [], 250)];
			const onSetFrameDuration = vi.fn();
			const { container } = render(TimelinePanel, {
				props: {
					layers,
					activeLayerId: 'a',
					...defaultProps,
					frames,
					activeFrameId: 'f1',
					onSetFrameDuration
				}
			});

			const input = durationInput(container);
			await fireEvent.input(input, { target: { value: '' } });
			await fireEvent.blur(input);

			expect(onSetFrameDuration).not.toHaveBeenCalled();
			expect(input.value).toBe('250');
		});

		it('reverts a non-numeric entry to the prior value without firing', async () => {
			const layers = [pixelLayer('a', 'Layer 1')];
			const frames = [frame('f1', [], 250)];
			const onSetFrameDuration = vi.fn();
			const { container } = render(TimelinePanel, {
				props: {
					layers,
					activeLayerId: 'a',
					...defaultProps,
					frames,
					activeFrameId: 'f1',
					onSetFrameDuration
				}
			});

			const input = durationInput(container);
			await fireEvent.input(input, { target: { value: 'abc' } });
			await fireEvent.blur(input);

			expect(onSetFrameDuration).not.toHaveBeenCalled();
			expect(input.value).toBe('250');
		});

		it('reverts a fractional entry without firing — duration is integer ms', async () => {
			const layers = [pixelLayer('a', 'Layer 1')];
			const frames = [frame('f1', [], 250)];
			const onSetFrameDuration = vi.fn();
			const { container } = render(TimelinePanel, {
				props: {
					layers,
					activeLayerId: 'a',
					...defaultProps,
					frames,
					activeFrameId: 'f1',
					onSetFrameDuration
				}
			});

			const input = durationInput(container);
			await fireEvent.input(input, { target: { value: '100.5' } });
			await fireEvent.blur(input);

			expect(onSetFrameDuration).not.toHaveBeenCalled();
			expect(input.value).toBe('250');
		});

		it('does not fire when the value is committed unchanged', async () => {
			const layers = [pixelLayer('a', 'Layer 1')];
			const frames = [frame('f1', [], 250)];
			const onSetFrameDuration = vi.fn();
			const { container } = render(TimelinePanel, {
				props: {
					layers,
					activeLayerId: 'a',
					...defaultProps,
					frames,
					activeFrameId: 'f1',
					onSetFrameDuration
				}
			});

			const input = durationInput(container);
			await fireEvent.input(input, { target: { value: '250' } });
			await fireEvent.blur(input);

			expect(onSetFrameDuration).not.toHaveBeenCalled();
		});

		it('forwards an out-of-range value unclamped — the WASM boundary owns the clamp', async () => {
			const layers = [pixelLayer('a', 'Layer 1')];
			const frames = [frame('f1', [], 100)];
			const onSetFrameDuration = vi.fn();
			const { container } = render(TimelinePanel, {
				props: {
					layers,
					activeLayerId: 'a',
					...defaultProps,
					frames,
					activeFrameId: 'f1',
					onSetFrameDuration
				}
			});

			const input = durationInput(container);
			await fireEvent.input(input, { target: { value: '99999' } });
			await fireEvent.keyDown(input, { key: 'Enter' });

			expect(onSetFrameDuration).toHaveBeenCalledWith('f1', 99999);
		});

		it('gives the duration input a descriptive accessible name', () => {
			const layers = [pixelLayer('a', 'Layer 1')];
			const { container } = render(TimelinePanel, {
				props: { layers, activeLayerId: 'a', ...defaultProps }
			});

			expect(durationInput(container).getAttribute('aria-label')).toBe(
				'Frame duration in milliseconds'
			);
		});

		it('shows a read-only fps helper derived from the active frame duration', () => {
			const layers = [pixelLayer('a', 'Layer 1')];
			const frames = [frame('f1', [], 250)];
			const { container } = render(TimelinePanel, {
				props: { layers, activeLayerId: 'a', ...defaultProps, frames, activeFrameId: 'f1' }
			});

			// 1000 / 250 ms = 4 fps.
			const fps = container.querySelector('[data-frame-duration-fps]') as HTMLElement;
			expect(fps.textContent).toContain('4');
		});

		it('includes the active frame duration in the collapsed summary', () => {
			const layers = [pixelLayer('a', 'Sky'), pixelLayer('b', 'Mountains')];
			const frames = [frame('f1', [], 100), frame('f2', [], 250), frame('f3', [], 100)];
			const { container } = render(TimelinePanel, {
				props: {
					layers,
					activeLayerId: 'b',
					...defaultProps,
					collapsed: true,
					frames,
					activeFrameId: 'f2'
				}
			});

			const header = container.querySelector('.timeline-panel .header') as HTMLElement;
			expect(header.textContent).toContain('250 ms');
		});
	});

	describe('transport strip', () => {
		it('renders the transport bar and forwards its play click to onTogglePlay', async () => {
			const onTogglePlay = vi.fn();
			const { container } = render(TimelinePanel, {
				props: {
					...defaultProps,
					layers: [pixelLayer('a', 'Layer 1')],
					activeLayerId: 'a',
					frames: [frame('f1'), frame('f2')],
					activeFrameId: 'f1',
					onTogglePlay
				}
			});

			expect(container.querySelector('[data-transport-bar]')).not.toBeNull();
			const play = container.querySelector('[data-transport-play]') as HTMLButtonElement;
			await fireEvent.click(play);
			expect(onTogglePlay).toHaveBeenCalledTimes(1);
		});

		it('forwards the onion skin toggle click and reflects its pressed state', async () => {
			const onToggleOnionSkin = vi.fn();
			const { container } = render(TimelinePanel, {
				props: {
					...defaultProps,
					layers: [pixelLayer('a', 'Layer 1')],
					activeLayerId: 'a',
					frames: [frame('f1'), frame('f2')],
					activeFrameId: 'f1',
					showOnionSkin: true,
					onToggleOnionSkin
				}
			});

			const onionSkin = container.querySelector(
				'[data-transport-onion-skin]'
			) as HTMLButtonElement;
			expect(onionSkin).not.toBeNull();
			expect(onionSkin.getAttribute('aria-pressed')).toBe('true');
			await fireEvent.click(onionSkin);
			expect(onToggleOnionSkin).toHaveBeenCalledTimes(1);
		});

		it('reads out the active-frame ordinal while stopped', () => {
			const { container } = render(TimelinePanel, {
				props: {
					...defaultProps,
					layers: [pixelLayer('a', 'Layer 1')],
					activeLayerId: 'a',
					frames: [frame('f1'), frame('f2'), frame('f3')],
					activeFrameId: 'f2',
					isPlaying: false,
					playheadFrameId: null
				}
			});

			const readout = container.querySelector('[data-transport-position]') as HTMLElement;
			expect(readout.textContent?.replace(/\s+/g, ' ').trim()).toBe('2 / 3');
		});

		it('reads out the playhead ordinal while playing', () => {
			const { container } = render(TimelinePanel, {
				props: {
					...defaultProps,
					layers: [pixelLayer('a', 'Layer 1')],
					activeLayerId: 'a',
					frames: [frame('f1'), frame('f2'), frame('f3')],
					activeFrameId: 'f1',
					isPlaying: true,
					playheadFrameId: 'f3'
				}
			});

			const readout = container.querySelector('[data-transport-position]') as HTMLElement;
			expect(readout.textContent?.replace(/\s+/g, ' ').trim()).toBe('3 / 3');
		});

		it('marks the playhead frame column with the ▼ marker while playing', () => {
			const { container } = render(TimelinePanel, {
				props: {
					...defaultProps,
					layers: [pixelLayer('a', 'Layer 1')],
					activeLayerId: 'a',
					frames: [frame('f1'), frame('f2'), frame('f3')],
					activeFrameId: 'f1',
					isPlaying: true,
					playheadFrameId: 'f2'
				}
			});

			const marker = container.querySelector('[data-playhead-marker]') as HTMLElement;
			expect(marker).not.toBeNull();
			expect(marker.getAttribute('data-playhead-frame-id')).toBe('f2');
		});

		it('renders no ▼ marker while stopped', () => {
			const { container } = render(TimelinePanel, {
				props: {
					...defaultProps,
					layers: [pixelLayer('a', 'Layer 1')],
					activeLayerId: 'a',
					frames: [frame('f1'), frame('f2')],
					activeFrameId: 'f1',
					isPlaying: false,
					playheadFrameId: null
				}
			});

			expect(container.querySelector('[data-playhead-marker]')).toBeNull();
		});

		it('hides the transport strip when the panel is collapsed', () => {
			const { container } = render(TimelinePanel, {
				props: {
					...defaultProps,
					layers: [pixelLayer('a', 'Layer 1')],
					activeLayerId: 'a',
					frames: [frame('f1'), frame('f2')],
					activeFrameId: 'f1',
					collapsed: true
				}
			});

			expect(container.querySelector('[data-transport-bar]')).toBeNull();
		});
	});
});
