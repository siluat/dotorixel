// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/svelte';
import TabBar from './TabBar.svelte';

afterEach(() => {
	cleanup();
});

describe('TabBar', () => {
	it('renders four tabs: draw, colors, layers, settings — in that visual order', () => {
		const { container } = render(TabBar, {
			props: { activeTab: 'draw', onTabChange: () => {} }
		});

		const tabs = container.querySelectorAll('.tab-item');
		expect(tabs.length).toBe(4);

		const ariaLabels = Array.from(tabs).map((t) => t.getAttribute('aria-label')?.toLowerCase());
		// LAYERS sits between COLORS and SETTINGS — the canonical mobile order in
		// 092 (DRAW / COLORS / LAYERS / SETTINGS).
		expect(ariaLabels[0]).toMatch(/draw/);
		expect(ariaLabels[1]).toMatch(/color/);
		expect(ariaLabels[2]).toMatch(/layer/);
		expect(ariaLabels[3]).toMatch(/setting/);
	});

	it('marks the active tab via aria-current="page"', () => {
		const { container } = render(TabBar, {
			props: { activeTab: 'layers', onTabChange: () => {} }
		});

		const tabs = container.querySelectorAll('.tab-item');
		const layersTab = tabs[2];
		expect(layersTab.getAttribute('aria-current')).toBe('page');
		expect(tabs[0].hasAttribute('aria-current')).toBe(false);
	});

	it('invokes onTabChange("layers") when the layers tab is clicked', async () => {
		const onTabChange = vi.fn();
		const { container } = render(TabBar, {
			props: { activeTab: 'draw', onTabChange }
		});

		const layersTab = container.querySelectorAll('.tab-item')[2] as HTMLButtonElement;
		await fireEvent.click(layersTab);

		expect(onTabChange).toHaveBeenCalledWith('layers');
		expect(onTabChange).toHaveBeenCalledTimes(1);
	});
});
