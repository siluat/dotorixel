// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/svelte';
import { afterEach, describe } from 'vitest';
import {
	createConstrainLatchToolbarDefaults,
	defineConstrainLatchToolbarContract,
	type ConstrainLatchToolbarProps
} from './constrain-latch-toolbar.test-helper';
import LeftToolbar from './LeftToolbar.svelte';

function renderLeftToolbar(props: Partial<ConstrainLatchToolbarProps> = {}) {
	const merged = { ...createConstrainLatchToolbarDefaults(), ...props };
	return render(LeftToolbar, { props: merged });
}

afterEach(() => {
	cleanup();
});

describe('LeftToolbar', () => {
	defineConstrainLatchToolbarContract(renderLeftToolbar, 'clicked');
});
