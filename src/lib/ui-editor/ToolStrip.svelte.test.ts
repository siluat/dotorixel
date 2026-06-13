// @vitest-environment happy-dom
import { vi } from 'vitest';
import { render } from '@testing-library/svelte';
import ToolStrip from './ToolStrip.svelte';
import type { ToolType } from '$lib/ui-editor/tool-ui';
import { describeToolbarConstrainLatch } from './toolbar-constrain-latch.contract';

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
	return render(ToolStrip, { props: { ...defaults, ...props } });
}

describeToolbarConstrainLatch('ToolStrip', 'tap', renderToolStrip);
