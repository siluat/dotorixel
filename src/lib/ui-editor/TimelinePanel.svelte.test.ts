// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/svelte';
import TimelinePanel from './TimelinePanel.svelte';

afterEach(() => {
	cleanup();
});

const noopAddLayer = () => {};

describe('TimelinePanel', () => {
	it('renders a single row showing the layer name when one layer is provided', () => {
		const layers = [{ id: 'a', name: 'Layer 1' }];
		const { container } = render(TimelinePanel, {
			props: { layers, activeLayerId: 'a', onAddLayer: noopAddLayer }
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
			props: { layers, activeLayerId: 'a', onAddLayer: noopAddLayer }
		});

		const rows = container.querySelectorAll('[data-layer-row]');
		expect(rows.length).toBe(3);
		const names = Array.from(rows).map((r) => r.textContent?.trim());
		expect(names).toEqual(expect.arrayContaining(['Layer 1', 'Layer 2', 'Hair']));
	});

	it('marks the active layer row with aria-current and leaves others unmarked', () => {
		const layers = [
			{ id: 'a', name: 'Layer 1' },
			{ id: 'b', name: 'Layer 2' },
			{ id: 'c', name: 'Layer 3' }
		];
		const { container } = render(TimelinePanel, {
			props: { layers, activeLayerId: 'b', onAddLayer: noopAddLayer }
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
			props: { layers, activeLayerId: 'a', onAddLayer: noopAddLayer }
		});

		const button = container.querySelector('[data-add-layer]');
		expect(button).not.toBeNull();
		expect(button?.tagName).toBe('BUTTON');
	});

	it('invokes onAddLayer when the add-layer button is clicked', async () => {
		const layers = [{ id: 'a', name: 'Layer 1' }];
		const onAddLayer = vi.fn();
		const { container } = render(TimelinePanel, {
			props: { layers, activeLayerId: 'a', onAddLayer }
		});

		const button = container.querySelector('[data-add-layer]') as HTMLButtonElement;
		await fireEvent.click(button);

		expect(onAddLayer).toHaveBeenCalledTimes(1);
	});
});
