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

	test('touch long-press opens loupe and drag-release commits final pixel color', async ({
		editorPage
	}) => {
		const { canvas, page } = editorPage;

		const hexValue = page.locator('.hex-value');
		const loupe = page.locator('[data-testid="loupe-root"]');

		// Step 1 — draw with color A at an off-center pixel so we have a known
		// opaque pixel to long-press on.
		const box = await canvas.canvasLocator.boundingBox();
		if (!box) throw new Error('Canvas not found');
		const pressPoint = { x: box.width * 0.25, y: box.height * 0.5 };
		const colorAHex = await hexValue.textContent();
		await canvas.canvasLocator.click({ position: pressPoint });

		// Step 2 — switch foreground to color B and draw at canvas center. The
		// drag will release over this pixel, so FG must end up as color B.
		const paletteSwatch = page.locator('.palette-grid .editor-swatch').first();
		await paletteSwatch.click();
		const colorBHex = await hexValue.textContent();
		expect(colorBHex).not.toBe(colorAHex);
		await canvas.clickCanvas();

		// Step 3 — switch to a non-eyedropper tool so the long-press path is
		// actually exercised (eyedropper would run the session through its own
		// draw lifecycle).
		await page.keyboard.press('p'); // Pencil

		const startClientX = box.x + pressPoint.x;
		const startClientY = box.y + pressPoint.y;
		const endClientX = box.x + box.width / 2;
		const endClientY = box.y + box.height / 2;

		// Step 4 — dispatch a touch pointerdown and wait past the 400ms
		// long-press threshold. PlaywrightChromium lacks a native long-press
		// helper for non-mobile projects, so we drive PointerEvents directly;
		// canvas-interaction reads `pointerType` so the path is identical to a
		// real touch.
		await page.evaluate(
			({ x, y }) => {
				const canvas = document.querySelector('canvas.pixel-canvas');
				if (!canvas) throw new Error('canvas not found');
				canvas.dispatchEvent(
					new PointerEvent('pointerdown', {
						bubbles: true,
						cancelable: true,
						pointerType: 'touch',
						pointerId: 1,
						clientX: x,
						clientY: y,
						button: 0,
						buttons: 1,
						isPrimary: true
					})
				);
			},
			{ x: startClientX, y: startClientY }
		);

		await page.waitForTimeout(450);

		// Step 5 — loupe must be visible once the sampling session has opened.
		await expect(loupe).toBeVisible();

		// Step 6 — drag the finger to the center pixel (color B). Dispatch
		// pointermove on the canvas element so canvas-interaction's in-canvas
		// pointerMove handler runs (the window-level handler is for pan/pinch
		// and does not forward to the sampling session).
		await page.evaluate(
			({ x, y }) => {
				const canvas = document.querySelector('canvas.pixel-canvas');
				if (!canvas) throw new Error('canvas not found');
				canvas.dispatchEvent(
					new PointerEvent('pointermove', {
						bubbles: true,
						cancelable: true,
						pointerType: 'touch',
						pointerId: 1,
						clientX: x,
						clientY: y,
						buttons: 1,
						isPrimary: true
					})
				);
			},
			{ x: endClientX, y: endClientY }
		);

		// Loupe stays visible mid-drag.
		await expect(loupe).toBeVisible();

		// Step 7 — release.
		await page.evaluate(
			({ x, y }) => {
				window.dispatchEvent(
					new PointerEvent('pointerup', {
						bubbles: true,
						cancelable: true,
						pointerType: 'touch',
						pointerId: 1,
						clientX: x,
						clientY: y,
						button: 0,
						buttons: 0,
						isPrimary: true
					})
				);
			},
			{ x: endClientX, y: endClientY }
		);

		await expect(loupe).toBeHidden();

		// FG must be the color at the release position (color B), not the
		// press position (color A).
		const pickedHex = await hexValue.textContent();
		expect(pickedHex).toBe(colorBHex);
		expect(pickedHex).not.toBe(colorAHex);
	});

	test('eyedropper drag released on a transparent pixel does not commit', async ({
		editorPage
	}) => {
		const { canvas, tools, page } = editorPage;

		const hexValue = page.locator('.hex-value');

		// Step 1 — draw an opaque pixel off-center with the initial foreground (color A).
		const colorAHex = await hexValue.textContent();
		const box = await canvas.canvasLocator.boundingBox();
		if (!box) throw new Error('Canvas not found');
		const opaquePoint = { x: box.width * 0.25, y: box.height * 0.5 };
		await canvas.canvasLocator.click({ position: opaquePoint });

		// Step 2 — switch foreground to a different color (color B). This is
		// the color we expect to survive the drag — if the commit incorrectly
		// used the preserved last-opaque sample, FG would flip back to A.
		// Guard against palette-swatch-default collision so the test never
		// passes vacuously if the default FG is later changed to match `.first()`.
		const paletteSwatch = page.locator('.palette-grid .editor-swatch').first();
		await paletteSwatch.click();
		const colorBHex = await hexValue.textContent();
		expect(colorBHex).not.toBe(colorAHex);

		// Step 3 — eyedropper drag from color-A pixel onto the default-transparent
		// canvas center (which was never drawn on), then release there.
		await tools.selectTool('Eyedropper');
		const startX = box.x + opaquePoint.x;
		const startY = box.y + opaquePoint.y;
		const endX = box.x + box.width / 2;
		const endY = box.y + box.height / 2;

		await page.mouse.move(startX, startY);
		await page.mouse.down();
		await page.mouse.move(endX, endY, { steps: 5 });
		await page.mouse.up();

		// Foreground must be unchanged — releasing on transparent commits nothing.
		const afterHex = await hexValue.textContent();
		expect(afterHex).toBe(colorBHex);
	});
});
