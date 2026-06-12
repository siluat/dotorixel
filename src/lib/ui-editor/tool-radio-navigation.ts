import { TOOL_ENTRIES, type ToolType } from '$lib/ui-editor/tool-ui';

const TOOL_ORDER = TOOL_ENTRIES.map((tool) => tool.type);

function getToolIndex(type: ToolType): number {
	const index = TOOL_ORDER.indexOf(type);

	if (index === -1) {
		throw new Error(`Unknown tool type: ${type}`);
	}

	return index;
}

function getOffsetTool(type: ToolType, offset: -1 | 1): ToolType {
	const index = getToolIndex(type);
	const nextIndex = (index + offset + TOOL_ORDER.length) % TOOL_ORDER.length;
	return TOOL_ORDER[nextIndex];
}

export function getToolRadioNavigationTarget(type: ToolType, key: string): ToolType | null {
	switch (key) {
		case 'ArrowRight':
		case 'ArrowDown':
			return getOffsetTool(type, 1);
		case 'ArrowLeft':
		case 'ArrowUp':
			return getOffsetTool(type, -1);
		default:
			return null;
	}
}

export function isToolRadioActivationKey(key: string): boolean {
	return key === ' ' || key === 'Enter';
}

export function focusToolRadio(group: HTMLElement | undefined, type: ToolType): void {
	const button = Array.from(group?.querySelectorAll<HTMLElement>('[data-tool-type]') ?? []).find(
		(element) => element.dataset.toolType === type
	);

	button?.focus();
}
