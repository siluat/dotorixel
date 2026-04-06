// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/svelte';
import { afterEach } from 'vitest';
import CanvasSizeControl from './CanvasSizeControl.svelte';

function renderControl(props: Record<string, unknown> = {}) {
	const defaultProps = {
		canvasWidth: 32,
		canvasHeight: 32,
		resizeAnchor: 'top-left' as const,
		onResize: vi.fn(),
		onAnchorChange: vi.fn()
	};

	const merged = { ...defaultProps, ...props };
	const result = render(CanvasSizeControl, { props: merged });

	return { ...result, ...merged };
}

afterEach(() => {
	cleanup();
});

describe('CanvasSizeControl', () => {
	it('calls onResize with (size, size) when a preset button is clicked', () => {
		const { container, onResize } = renderControl();

		const presetButtons = container.querySelectorAll('.preset-btn');
		expect(presetButtons.length).toBeGreaterThan(0);

		const firstButton = presetButtons[0] as HTMLButtonElement;
		fireEvent.click(firstButton);

		expect(onResize).toHaveBeenCalledTimes(1);
		const [width, height] = onResize.mock.calls[0];
		expect(width).toBe(height);
		expect(typeof width).toBe('number');
		expect(width).toBeGreaterThan(0);
	});

	it('calls onResize when a valid dimension is entered and input is blurred', async () => {
		const { container, onResize } = renderControl({ canvasWidth: 32, canvasHeight: 32 });

		const widthInput = container.querySelector('.size-input') as HTMLInputElement;
		expect(widthInput).not.toBeNull();

		await fireEvent.input(widthInput, { target: { value: '64' } });
		await fireEvent.blur(widthInput);

		expect(onResize).toHaveBeenCalledWith(64, 32);
	});

	it('calls onResize when Enter is pressed in the input', async () => {
		const { container, onResize } = renderControl({ canvasWidth: 32, canvasHeight: 32 });

		const widthInput = container.querySelector('.size-input') as HTMLInputElement;

		await fireEvent.input(widthInput, { target: { value: '48' } });
		await fireEvent.keyDown(widthInput, { key: 'Enter' });

		expect(onResize).toHaveBeenCalledWith(48, 32);
	});

	it('does not call onResize when committed dimensions are unchanged', async () => {
		const { container, onResize } = renderControl({ canvasWidth: 32, canvasHeight: 32 });

		const widthInput = container.querySelector('.size-input') as HTMLInputElement;
		await fireEvent.blur(widthInput);

		expect(onResize).not.toHaveBeenCalled();
	});

	it('shows validation alert and does not call onResize for invalid dimensions', async () => {
		const { container, onResize } = renderControl({ canvasWidth: 32, canvasHeight: 32 });

		const widthInput = container.querySelector('.size-input') as HTMLInputElement;
		await fireEvent.input(widthInput, { target: { value: '0' } });
		await fireEvent.blur(widthInput);

		expect(onResize).not.toHaveBeenCalled();
		expect(container.querySelector('.validation-alert')).not.toBeNull();
	});

	it('resets inputs and clears validation when props change externally', async () => {
		const { container, rerender, onResize } = renderControl({ canvasWidth: 32, canvasHeight: 32 });

		// Trigger validation error
		const widthInput = container.querySelector('.size-input') as HTMLInputElement;
		await fireEvent.input(widthInput, { target: { value: '0' } });
		await fireEvent.blur(widthInput);
		expect(container.querySelector('.validation-alert')).not.toBeNull();

		// External prop change
		await rerender({ canvasWidth: 64, canvasHeight: 64, resizeAnchor: 'top-left', onResize, onAnchorChange: vi.fn() });

		expect(container.querySelector('.validation-alert')).toBeNull();
		const inputs = container.querySelectorAll('.size-input') as NodeListOf<HTMLInputElement>;
		expect(inputs[0].value).toBe('64');
		expect(inputs[1].value).toBe('64');
	});

	it('calls onAnchorChange when an anchor cell is clicked', () => {
		const { container, onAnchorChange } = renderControl();

		const anchorCells = container.querySelectorAll('.anchor-cell');
		expect(anchorCells.length).toBe(9);

		// Click the center cell (5th, index 4)
		fireEvent.click(anchorCells[4]);

		expect(onAnchorChange).toHaveBeenCalledWith('center');
	});

	it('compact variant does not render input labels', () => {
		const { container } = renderControl({ variant: 'compact' });

		expect(container.querySelector('.size-label')).toBeNull();
	});

	it('touch variant renders W/H input labels', () => {
		const { container } = renderControl({ variant: 'touch' });

		const labels = container.querySelectorAll('.size-label');
		expect(labels.length).toBe(2);
		expect(labels[0].textContent).toBe('W');
		expect(labels[1].textContent).toBe('H');
	});
});
