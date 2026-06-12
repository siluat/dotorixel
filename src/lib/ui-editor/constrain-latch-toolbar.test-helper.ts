import { fireEvent, screen } from '@testing-library/svelte';
import { expect, it, vi } from 'vitest';
import type { ToolType } from '$lib/canvas/tool-registry';
import { TOOL_ENTRIES, isConstrainableTool } from '$lib/ui-editor/tool-ui';

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

const CONSTRAINABLE_TOOLS = TOOL_ENTRIES.filter((tool) => isConstrainableTool(tool.type)).map(
	(tool) => tool.type
);
const NON_CONSTRAINABLE_TOOLS = TOOL_ENTRIES.filter((tool) => !isConstrainableTool(tool.type)).map(
	(tool) => tool.type
);

function getToolLabel(type: ToolType): string {
	const entry = TOOL_ENTRIES.find((tool) => tool.type === type);

	if (!entry) {
		throw new Error(`Unknown tool type: ${type}`);
	}

	return entry.label();
}

function getToolButton(type: ToolType): HTMLElement {
	return screen.getByRole('radio', { name: getToolLabel(type) });
}

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

			await fireEvent.click(getToolButton(activeTool));

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

			await fireEvent.click(getToolButton(activeTool));

			expect(onConstrainLatchToggle).not.toHaveBeenCalled();
			expect(screen.queryByRole('button', { name: 'Constrain' })).toBeNull();
		}
	);

	it('marks the active constrainable tool when the latch is on', () => {
		renderToolbar({ activeTool: 'line', constrainLatchOn: true });
		const activeButton = getToolButton('line');

		expect(activeButton.classList.contains('latched')).toBe(true);
		expect(activeButton.getAttribute('role')).toBe('radio');
		expect(activeButton.getAttribute('aria-checked')).toBe('true');
		expect(activeButton.hasAttribute('aria-current')).toBe(false);
		expect(activeButton.hasAttribute('aria-pressed')).toBe(false);
		expect(screen.getByRole('radiogroup', { name: 'Drawing Tools' })).toBeTruthy();
	});

	it('does not mark a non-constrainable active tool when the latch is on', () => {
		renderToolbar({ activeTool: 'pencil', constrainLatchOn: true });
		const activeButton = getToolButton('pencil');

		expect(activeButton.classList.contains('latched')).toBe(false);
		expect(activeButton.getAttribute('role')).toBe('radio');
		expect(activeButton.getAttribute('aria-checked')).toBe('true');
		expect(activeButton.hasAttribute('aria-current')).toBe(false);
		expect(activeButton.hasAttribute('aria-pressed')).toBe(false);
		expect(screen.queryByRole('status')).toBeNull();
	});

	it('selects another tool instead of toggling Constrain', async () => {
		const onToolChange = vi.fn<(tool: ToolType) => void>();
		const onConstrainLatchToggle = vi.fn<() => void>();

		renderToolbar({ activeTool: 'line', onToolChange, onConstrainLatchToggle });

		await fireEvent.click(getToolButton('rectangle'));

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
		expect(getToolButton('line').getAttribute('aria-describedby')).toBe(status.id);
	});

	it('uses instance-unique status ids when multiple toolbars are mounted', () => {
		renderToolbar({ activeTool: 'line', constrainLatchOn: true });
		renderToolbar({ activeTool: 'rectangle', constrainLatchOn: true });
		const statusIds = screen.getAllByRole('status').map((status) => status.id);

		expect(new Set(statusIds).size).toBe(statusIds.length);
	});
}
