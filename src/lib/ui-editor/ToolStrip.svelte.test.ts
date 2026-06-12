// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/svelte';
import ToolStrip from './ToolStrip.svelte';
import type { ToolType } from '$lib/ui-editor/tool-ui';

function renderToolStrip(props: Record<string, unknown> = {}) {
	const defaults = {
		activeTool: 'line' as ToolType,
		canUndo: true,
		canRedo: false,
		constrainActive: false,
		onToolChange: vi.fn(),
		onUndo: vi.fn(),
		onRedo: vi.fn(),
		onToggleConstrain: vi.fn()
	};
	const merged = { ...defaults, ...props };
	const result = render(ToolStrip, { props: merged });
	return { ...result, ...merged };
}

/** Tool button lookup tolerant of the latched label suffix, e.g. "Line (Constrain)". */
function findToolButton(container: HTMLElement, label: string): HTMLButtonElement | null {
	return container.querySelector<HTMLButtonElement>(`button[aria-label^="${label}"]`);
}

afterEach(() => {
	cleanup();
});

describe('ToolStrip — Constrain latch via re-tap', () => {
	const CONSTRAINABLE: [ToolType, string][] = [
		['line', 'Line'],
		['rectangle', 'Rectangle'],
		['ellipse', 'Ellipse'],
		['selection', 'Selection']
	];

	it.each(CONSTRAINABLE)(
		're-tapping the active %s tool toggles the Constrain latch instead of re-selecting',
		async (activeTool, label) => {
			const onToggleConstrain = vi.fn();
			const onToolChange = vi.fn();
			const { container } = renderToolStrip({ activeTool, onToggleConstrain, onToolChange });

			await fireEvent.click(findToolButton(container, label)!);

			expect(onToggleConstrain).toHaveBeenCalledOnce();
			expect(onToolChange).not.toHaveBeenCalled();
		}
	);

	it('tapping an inactive tool switches tools without touching the latch', async () => {
		const onToggleConstrain = vi.fn();
		const onToolChange = vi.fn();
		const { container } = renderToolStrip({
			activeTool: 'line',
			onToggleConstrain,
			onToolChange
		});

		await fireEvent.click(findToolButton(container, 'Rectangle')!);

		expect(onToolChange).toHaveBeenCalledWith('rectangle');
		expect(onToggleConstrain).not.toHaveBeenCalled();
	});

	it('re-tapping the active non-constrainable pencil tool never toggles the latch', async () => {
		const onToggleConstrain = vi.fn();
		const onToolChange = vi.fn();
		const { container } = renderToolStrip({
			activeTool: 'pencil',
			onToggleConstrain,
			onToolChange
		});

		await fireEvent.click(findToolButton(container, 'Pencil')!);

		expect(onToggleConstrain).not.toHaveBeenCalled();
		expect(onToolChange).toHaveBeenCalledWith('pencil');
	});

	it('announces the Constrain state on the active tool while the latch is on', () => {
		const { container } = renderToolStrip({ activeTool: 'line', constrainActive: true });

		expect(container.querySelector('button[aria-label="Line (Constrain)"]')).toBeTruthy();
	});

	it('announces the plain tool label while the latch is off', () => {
		const { container } = renderToolStrip({ activeTool: 'line', constrainActive: false });

		expect(container.querySelector('button[aria-label="Line"]')).toBeTruthy();
		expect(container.querySelector('button[aria-label="Line (Constrain)"]')).toBeNull();
	});

	it('does not announce Constrain on a non-constrainable active tool even while the latch is on', () => {
		const { container } = renderToolStrip({ activeTool: 'pencil', constrainActive: true });

		expect(container.querySelector('button[aria-label="Pencil"]')).toBeTruthy();
		expect(container.querySelector('button[aria-label="Pencil (Constrain)"]')).toBeNull();
	});

	it('does not announce Constrain on inactive constrainable tools while the latch is on', () => {
		const { container } = renderToolStrip({ activeTool: 'line', constrainActive: true });

		expect(container.querySelector('button[aria-label="Rectangle"]')).toBeTruthy();
		expect(container.querySelector('button[aria-label="Rectangle (Constrain)"]')).toBeNull();
	});
});
