import { test, expect } from './fixtures';

test.describe('Drawing', () => {
	test('default state: pencil active, history disabled', async ({ editorPage }) => {
		const { canvas, tools, history, page } = editorPage;

		await expect(canvas.canvasLocator).toBeVisible();
		expect(await tools.getActiveTool()).toBe('Pencil');
		expect(await history.canUndo()).toBe(false);
		expect(await history.canRedo()).toBe(false);

		// Status bar shows default 16x16 and Pencil
		await expect(page.locator('.status-size')).toContainText('16');
		await expect(page.locator('.status-tool')).toHaveText('Pencil');
	});

	test('tool switching via button click', async ({ editorPage }) => {
		const { tools } = editorPage;
		const toolNames = [
			'Pencil', 'Eraser', 'Line', 'Rectangle',
			'Ellipse', 'Flood Fill', 'Eyedropper', 'Move',
		];

		for (const name of toolNames) {
			await tools.selectTool(name);
			expect(await tools.getActiveTool()).toBe(name);
		}
	});

	test('tool switching via keyboard shortcut', async ({ editorPage }) => {
		const { tools, page } = editorPage;
		const shortcuts: [string, string][] = [
			['p', 'Pencil'],
			['l', 'Line'],
			['u', 'Rectangle'],
			['o', 'Ellipse'],
			['e', 'Eraser'],
			['f', 'Flood Fill'],
			['i', 'Eyedropper'],
			['v', 'Move'],
		];

		for (const [key, expected] of shortcuts) {
			await page.keyboard.press(key);
			expect(await tools.getActiveTool()).toBe(expected);
		}
	});

	test('drawing a pixel with pencil changes the canvas', async ({ editorPage }) => {
		const { canvas } = editorPage;

		const before = await canvas.readPixelAtCenter();
		await canvas.clickCanvas();
		const after = await canvas.readPixelAtCenter();

		expect(canvas.pixelEquals(before, after)).toBe(false);
	});

	test('erasing a drawn pixel reverts the canvas', async ({ editorPage }) => {
		const { canvas, tools } = editorPage;

		const original = await canvas.readPixelAtCenter();

		// Draw with pencil
		await canvas.clickCanvas();
		const drawn = await canvas.readPixelAtCenter();
		expect(canvas.pixelEquals(original, drawn)).toBe(false);

		// Erase at same position
		await tools.selectTool('Eraser');
		await canvas.clickCanvas();
		const erased = await canvas.readPixelAtCenter();

		expect(canvas.pixelEquals(original, erased)).toBe(true);
	});

	test('eyedropper picks color from canvas', async ({ editorPage }) => {
		const { canvas, tools, page } = editorPage;

		const hexValue = page.locator('.hex-value');
		const initialHex = await hexValue.textContent();

		// Draw a pixel with initial foreground color
		await canvas.clickCanvas();

		// Change foreground color via palette swatch
		const paletteSwatch = page.locator('.palette-grid .editor-swatch').first();
		await paletteSwatch.click();
		const changedHex = await hexValue.textContent();
		expect(changedHex).not.toBe(initialHex);

		// Use eyedropper on the drawn pixel to recover the original color
		await tools.selectTool('Eyedropper');
		await canvas.clickCanvas();

		const pickedHex = await hexValue.textContent();
		expect(pickedHex).toBe(initialHex);
	});
});
