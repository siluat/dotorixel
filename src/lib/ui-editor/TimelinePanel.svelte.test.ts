// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import TimelinePanel from './TimelinePanel.svelte';

afterEach(() => {
	cleanup();
});

describe('TimelinePanel', () => {
	it('renders a single row showing the layer name when one layer is provided', () => {
		const layers = [{ id: 'a', name: 'Layer 1' }];
		const { container } = render(TimelinePanel, {
			props: { layers, activeLayerId: 'a' }
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
			props: { layers, activeLayerId: 'a' }
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
			props: { layers, activeLayerId: 'b' }
		});

		const rowB = container.querySelector('[data-layer-row][data-layer-id="b"]');
		const rowA = container.querySelector('[data-layer-row][data-layer-id="a"]');
		const rowC = container.querySelector('[data-layer-row][data-layer-id="c"]');

		expect(rowB?.getAttribute('aria-current')).toBe('true');
		expect(rowA?.hasAttribute('aria-current')).toBe(false);
		expect(rowC?.hasAttribute('aria-current')).toBe(false);
	});
});
