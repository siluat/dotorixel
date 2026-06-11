// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/svelte';
import { afterEach, describe } from 'vitest';
import {
	createConstrainLatchToolbarDefaults,
	defineConstrainLatchToolbarContract,
	type ConstrainLatchToolbarProps
} from './constrain-latch-toolbar.test-helper';
import ToolStrip from './ToolStrip.svelte';

function renderToolStrip(props: Partial<ConstrainLatchToolbarProps> = {}) {
	const merged = { ...createConstrainLatchToolbarDefaults(), ...props };
	return render(ToolStrip, { props: merged });
}

afterEach(() => {
	cleanup();
});

describe('ToolStrip', () => {
	defineConstrainLatchToolbarContract(renderToolStrip, 'tapped');
});
