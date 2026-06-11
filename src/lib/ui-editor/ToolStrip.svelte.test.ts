// @vitest-environment happy-dom
import { cleanup, fireEvent, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ToolType } from '$lib/canvas/tool-registry';
import ToolStrip from './ToolStrip.svelte';

const LABEL_BY_TOOL: Record<ToolType, string> = {
	pencil: 'Pencil',
	line: 'Line',
	rectangle: 'Rectangle',
	ellipse: 'Ellipse',
	eraser: 'Eraser',
	floodfill: 'Flood Fill',
	eyedropper: 'Eyedropper',
	move: 'Move',
	selection: 'Selection'
};

function renderToolStrip(props: Record<string, unknown> = {}) {
	const defaults = {
		activeTool: 'line' as ToolType,
		canUndo: true,
		canRedo: true,
		constrainLatchOn: false,
		onToolChange: vi.fn(),
		onUndo: vi.fn(),
		onRedo: vi.fn(),
		onConstrainLatchToggle: vi.fn()
	};
	const merged = { ...defaults, ...props };
	const result = render(ToolStrip, { props: merged });
	return { ...result, ...merged };
}

afterEach(() => {
	cleanup();
});

describe('ToolStrip', () => {
	it.each<ToolType>(['line', 'rectangle', 'ellipse', 'selection'])(
		'toggles Constrain when active %s is tapped again',
		async (activeTool) => {
			const onConstrainLatchToggle = vi.fn();
			const onToolChange = vi.fn();
			const { getByRole, queryByRole } = renderToolStrip({
				activeTool,
				onConstrainLatchToggle,
				onToolChange
			});

			expect(queryByRole('button', { name: 'Constrain' })).toBeNull();

			await fireEvent.click(getByRole('button', { name: LABEL_BY_TOOL[activeTool] }));

			expect(onConstrainLatchToggle).toHaveBeenCalledOnce();
			expect(onToolChange).not.toHaveBeenCalled();
			expect(queryByRole('button', { name: 'Constrain' })).toBeNull();
		}
	);

	it.each<ToolType>(['pencil', 'eraser', 'floodfill', 'eyedropper', 'move'])(
		'does not toggle Constrain when active %s is tapped again',
		async (activeTool) => {
			const onConstrainLatchToggle = vi.fn();
			const { getByRole, queryByRole } = renderToolStrip({ activeTool, onConstrainLatchToggle });

			await fireEvent.click(getByRole('button', { name: LABEL_BY_TOOL[activeTool] }));

			expect(onConstrainLatchToggle).not.toHaveBeenCalled();
			expect(queryByRole('button', { name: 'Constrain' })).toBeNull();
		}
	);

	it('marks the active constrainable tool when the latch is on', () => {
		const { getByRole } = renderToolStrip({ activeTool: 'line', constrainLatchOn: true });

		expect(getByRole('button', { name: 'Line' }).classList.contains('latched')).toBe(true);
	});

	it('does not mark a non-constrainable active tool when the latch is on', () => {
		const { getByRole } = renderToolStrip({ activeTool: 'pencil', constrainLatchOn: true });

		expect(getByRole('button', { name: 'Pencil' }).classList.contains('latched')).toBe(false);
	});

	it('selects another tool instead of toggling Constrain', async () => {
		const onToolChange = vi.fn();
		const onConstrainLatchToggle = vi.fn();
		const { getByRole } = renderToolStrip({ activeTool: 'line', onToolChange, onConstrainLatchToggle });

		await fireEvent.click(getByRole('button', { name: 'Rectangle' }));

		expect(onToolChange).toHaveBeenCalledWith('rectangle');
		expect(onConstrainLatchToggle).not.toHaveBeenCalled();
	});

	it('describes the active constrainable tool state accessibly', () => {
		const { getByText, getByRole } = renderToolStrip({ activeTool: 'line', constrainLatchOn: true });
		const status = getByText('Constrain is on. Activate this tool again to turn it off.');

		expect(status.id).toBeTruthy();
		expect(getByRole('button', { name: 'Line' }).getAttribute('aria-describedby')).toBe(status.id);
	});
});
