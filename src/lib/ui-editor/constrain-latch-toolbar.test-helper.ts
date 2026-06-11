import { fireEvent, screen } from '@testing-library/svelte';
import { expect, it, vi } from 'vitest';
import type { ToolType } from '$lib/canvas/tool-registry';

export interface ConstrainLatchToolbarProps {
	activeTool: ToolType;
	canUndo: boolean;
	canRedo: boolean;
	constrainLatchOn: boolean;
	onToolChange: (tool: ToolType) => void;
	onUndo: () => void;
	onRedo: () => void;
	onConstrainLatchToggle: () => void;
}

type RenderToolbar = (props?: Partial<ConstrainLatchToolbarProps>) => unknown;

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

const CONSTRAINABLE_TOOLS: ToolType[] = ['line', 'rectangle', 'ellipse', 'selection'];
const NON_CONSTRAINABLE_TOOLS: ToolType[] = [
	'pencil',
	'eraser',
	'floodfill',
	'eyedropper',
	'move'
];

export function createConstrainLatchToolbarDefaults(): ConstrainLatchToolbarProps {
	return {
		activeTool: 'line',
		canUndo: true,
		canRedo: true,
		constrainLatchOn: false,
		onToolChange: vi.fn<(tool: ToolType) => void>(),
		onUndo: vi.fn<() => void>(),
		onRedo: vi.fn<() => void>(),
		onConstrainLatchToggle: vi.fn<() => void>()
	};
}

export function defineConstrainLatchToolbarContract(
	renderToolbar: RenderToolbar,
	interactionVerb: 'clicked' | 'tapped'
) {
	it.each<ToolType>(CONSTRAINABLE_TOOLS)(
		`toggles Constrain when active %s is ${interactionVerb} again`,
		async (activeTool) => {
			const onConstrainLatchToggle = vi.fn<() => void>();
			const onToolChange = vi.fn<(tool: ToolType) => void>();

			renderToolbar({ activeTool, onConstrainLatchToggle, onToolChange });

			expect(screen.queryByRole('button', { name: 'Constrain' })).toBeNull();

			await fireEvent.click(screen.getByRole('button', { name: LABEL_BY_TOOL[activeTool] }));

			expect(onConstrainLatchToggle).toHaveBeenCalledOnce();
			expect(onToolChange).not.toHaveBeenCalled();
			expect(screen.queryByRole('button', { name: 'Constrain' })).toBeNull();
		}
	);

	it.each<ToolType>(NON_CONSTRAINABLE_TOOLS)(
		`does not toggle Constrain when active %s is ${interactionVerb} again`,
		async (activeTool) => {
			const onConstrainLatchToggle = vi.fn<() => void>();

			renderToolbar({ activeTool, onConstrainLatchToggle });

			await fireEvent.click(screen.getByRole('button', { name: LABEL_BY_TOOL[activeTool] }));

			expect(onConstrainLatchToggle).not.toHaveBeenCalled();
			expect(screen.queryByRole('button', { name: 'Constrain' })).toBeNull();
		}
	);

	it('marks the active constrainable tool when the latch is on', () => {
		renderToolbar({ activeTool: 'line', constrainLatchOn: true });

		expect(screen.getByRole('button', { name: 'Line' }).classList.contains('latched')).toBe(true);
	});

	it('does not mark a non-constrainable active tool when the latch is on', () => {
		renderToolbar({ activeTool: 'pencil', constrainLatchOn: true });

		expect(screen.getByRole('button', { name: 'Pencil' }).classList.contains('latched')).toBe(false);
		expect(screen.queryByRole('status')).toBeNull();
	});

	it('selects another tool instead of toggling Constrain', async () => {
		const onToolChange = vi.fn<(tool: ToolType) => void>();
		const onConstrainLatchToggle = vi.fn<() => void>();

		renderToolbar({ activeTool: 'line', onToolChange, onConstrainLatchToggle });

		await fireEvent.click(screen.getByRole('button', { name: 'Rectangle' }));

		expect(onToolChange).toHaveBeenCalledWith('rectangle');
		expect(onConstrainLatchToggle).not.toHaveBeenCalled();
	});

	it('announces the active constrainable tool state accessibly', () => {
		renderToolbar({ activeTool: 'line', constrainLatchOn: true });

		const status = screen.getByRole('status');

		expect(status.id).toBeTruthy();
		expect(status.getAttribute('aria-live')).toBe('polite');
		expect(status.textContent?.trim()).toBe(
			'Constrain is on. Activate this tool again to turn it off.'
		);
		expect(screen.getByRole('button', { name: 'Line' }).getAttribute('aria-describedby')).toBe(
			status.id
		);
	});
}
