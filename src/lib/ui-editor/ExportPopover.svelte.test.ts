// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import ExportPopover from './ExportPopover.svelte';

// Selection-driven behaviors (placeholder switching to the sheet-marked stem,
// confirm handing the selected format to onExport) live in e2e/editor/export.test.ts:
// happy-dom's `:checked` matcher only supports INPUT elements, so Svelte 5's
// select binding (which reads `select.querySelector(':checked')` on change)
// cannot be driven here.
function renderPopover(props: Record<string, unknown> = {}) {
	const defaultProps = {
		canvasWidth: 16,
		canvasHeight: 16,
		onExport: vi.fn(),
		onClose: vi.fn()
	};

	const merged = { ...defaultProps, ...props };
	const result = render(ExportPopover, { props: merged });

	return { ...result, ...merged };
}

afterEach(() => {
	cleanup();
});

describe('ExportPopover', () => {
	it('lists every registry format as a selectable option', () => {
		const { container } = renderPopover();

		const options = [...container.querySelectorAll('.format-select option')];
		const values = options.map((o) => (o as HTMLOptionElement).value);

		expect(values).toEqual(['png', 'svg', 'gif', 'spritesheet']);
	});

	it('shows the shared default stem as the filename placeholder for still formats', () => {
		const { container } = renderPopover();

		const input = container.querySelector('.filename-input') as HTMLInputElement;

		expect(input.placeholder).toBe('dotorixel-16x16');
	});
});
