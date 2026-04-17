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

	test('eyedropper drag commits the final pixel color, loupe is visible mid-drag', async ({
		editorPage
	}) => {
		const { canvas, tools, page } = editorPage;

		const hexValue = page.locator('.hex-value');
		const loupe = page.locator('[data-testid="loupe-root"]');

		// Step 1 — draw at an off-center pixel with the initial foreground (color A).
		const box = await canvas.canvasLocator.boundingBox();
		if (!box) throw new Error('Canvas not found');
		const offCenter = { x: box.width * 0.25, y: box.height * 0.5 };
		const colorAHex = await hexValue.textContent();
		await canvas.canvasLocator.click({ position: offCenter });

		// Step 2 — switch foreground to a different color (color B) via the palette.
		const paletteSwatch = page.locator('.palette-grid .editor-swatch').first();
		await paletteSwatch.click();
		const colorBHex = await hexValue.textContent();
		expect(colorBHex).not.toBe(colorAHex);

		// Step 3 — draw at canvas center with color B so the drag endpoint has a known color.
		await canvas.clickCanvas();

		// Step 4 — eyedropper drag from the color-A pixel to the color-B pixel.
		await tools.selectTool('Eyedropper');
		const startX = box.x + offCenter.x;
		const startY = box.y + offCenter.y;
		const endX = box.x + box.width / 2;
		const endY = box.y + box.height / 2;

		await page.mouse.move(startX, startY);
		await page.mouse.down();
		// Step through a few intermediate positions so liveSample.draw fires `update`s.
		await page.mouse.move(startX + 10, startY, { steps: 2 });

		// Loupe overlay must be visible while the sampling session is active.
		await expect(loupe).toBeVisible();

		await page.mouse.move(endX, endY, { steps: 5 });
		await page.mouse.up();

		// Loupe is torn down once the drag ends.
		await expect(loupe).toBeHidden();

		// Foreground must now match color B (the drag endpoint, not the starting pixel).
		const pickedHex = await hexValue.textContent();
		expect(pickedHex).toBe(colorBHex);
		expect(pickedHex).not.toBe(colorAHex);
	});
});
