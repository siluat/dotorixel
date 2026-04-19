import { test, expect, readArtGeometry } from './fixtures';

function readPixelAt({ px, py }: { px: number; py: number }) {
	const canvas = document.querySelector<HTMLCanvasElement>('canvas.pixel-canvas');
	if (!canvas) throw new Error('Canvas not found');
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('No 2d context');
	const p = ctx.getImageData(px, py, 1, 1).data;
	return { r: p[0], g: p[1], b: p[2], a: p[3] };
}

test.describe('Pixel Perfect', () => {
	test('L-shape pencil drag reverts the corner middle pixel', async ({ editorPage }) => {
		const { canvas, page } = editorPage;
		await canvas.canvasLocator.waitFor({ state: 'visible' });

		const geo = await page.evaluate(readArtGeometry);
		const box = await canvas.canvasLocator.boundingBox();
		if (!box) throw new Error('No bounding box');
		const cssScale = box.width / geo.canvasWidth;

		// Pick three adjacent art pixels forming an L: (a-1, b) → (a, b) → (a, b-1).
		// Aim near the canvas center to stay safely inside bounds.
		const aArt = Math.floor(geo.artPixelsAcross / 2);
		const bArt = Math.floor(geo.artPixelsDown / 2);

		// Convert art-pixel index to internal canvas coords (pixel center), then to CSS.
		const toCss = (artX: number, artY: number) => {
			const canvasX = geo.artLeft + artX * geo.pixelSize + geo.pixelSize / 2;
			const canvasY = geo.artTop + artY * geo.pixelSize + geo.pixelSize / 2;
			return { cssX: canvasX * cssScale, cssY: canvasY * cssScale, canvasX, canvasY };
		};

		const start = toCss(aArt - 1, bArt);
		const corner = toCss(aArt, bArt);
		const end = toCss(aArt, bArt - 1);

		const initialCornerPixel = await page.evaluate(readPixelAt, { px: corner.canvasX, py: corner.canvasY });
		const initialStartPixel = await page.evaluate(readPixelAt, { px: start.canvasX, py: start.canvasY });
		const initialEndPixel = await page.evaluate(readPixelAt, { px: end.canvasX, py: end.canvasY });

		// Continuous L-shape drag.
		await page.mouse.move(box.x + start.cssX, box.y + start.cssY);
		await page.mouse.down();
		await page.mouse.move(box.x + corner.cssX, box.y + corner.cssY, { steps: 8 });
		await page.mouse.move(box.x + end.cssX, box.y + end.cssY, { steps: 8 });
		await page.mouse.up();

		const startAfter = await page.evaluate(readPixelAt, { px: start.canvasX, py: start.canvasY });
		const cornerAfter = await page.evaluate(readPixelAt, { px: corner.canvasX, py: corner.canvasY });
		const endAfter = await page.evaluate(readPixelAt, { px: end.canvasX, py: end.canvasY });

		// Endpoints painted, L-corner middle reverted to its initial color.
		expect(canvas.pixelEquals(startAfter, initialStartPixel)).toBe(false);
		expect(canvas.pixelEquals(endAfter, initialEndPixel)).toBe(false);
		expect(canvas.pixelEquals(cornerAfter, initialCornerPixel)).toBe(true);
	});

	test('toggle OFF preserves the corner middle pixel on pencil L-shape drag', async ({ editorPage }) => {
		const { canvas, page } = editorPage;
		await canvas.canvasLocator.waitFor({ state: 'visible' });

		// Flip PP off from its default ON state via the topBar toggle.
		await page.getByRole('button', { name: 'Pixel Perfect: On' }).click();
		await expect(page.getByRole('button', { name: 'Pixel Perfect: Off' })).toBeVisible();

		const geo = await page.evaluate(readArtGeometry);
		const box = await canvas.canvasLocator.boundingBox();
		if (!box) throw new Error('No bounding box');
		const cssScale = box.width / geo.canvasWidth;

		const aArt = Math.floor(geo.artPixelsAcross / 2);
		const bArt = Math.floor(geo.artPixelsDown / 2);

		const toCss = (artX: number, artY: number) => {
			const canvasX = geo.artLeft + artX * geo.pixelSize + geo.pixelSize / 2;
			const canvasY = geo.artTop + artY * geo.pixelSize + geo.pixelSize / 2;
			return { cssX: canvasX * cssScale, cssY: canvasY * cssScale, canvasX, canvasY };
		};

		const start = toCss(aArt - 1, bArt);
		const corner = toCss(aArt, bArt);
		const end = toCss(aArt, bArt - 1);

		const initialCornerPixel = await page.evaluate(readPixelAt, { px: corner.canvasX, py: corner.canvasY });

		await page.mouse.move(box.x + start.cssX, box.y + start.cssY);
		await page.mouse.down();
		await page.mouse.move(box.x + corner.cssX, box.y + corner.cssY, { steps: 8 });
		await page.mouse.move(box.x + end.cssX, box.y + end.cssY, { steps: 8 });
		await page.mouse.up();

		const cornerAfter = await page.evaluate(readPixelAt, { px: corner.canvasX, py: corner.canvasY });

		// PP OFF: Bresenham output preserved — the L-corner middle pixel is
		// painted the foreground color, not reverted to the background.
		expect(canvas.pixelEquals(cornerAfter, initialCornerPixel)).toBe(false);
	});

	test('toggle state persists across reload', async ({ editorPage }) => {
		const { canvas, page } = editorPage;
		await canvas.canvasLocator.waitFor({ state: 'visible' });

		// Flip ON → OFF.
		await page.getByRole('button', { name: 'Pixel Perfect: On' }).click();
		await expect(page.getByRole('button', { name: 'Pixel Perfect: Off' })).toBeVisible();

		// Autosave is debounced; wait until the workspace record actually
		// contains pixelPerfect=false before reloading. Without this the
		// reload races the debounce and the preference round-trip can't be
		// observed.
		await page.waitForFunction(
			() =>
				new Promise<boolean>((resolve) => {
					const req = indexedDB.open('dotorixel');
					req.onsuccess = () => {
						const db = req.result;
						const tx = db.transaction('workspace', 'readonly');
						const get = tx.objectStore('workspace').get('current');
						get.onsuccess = () => {
							const record = get.result as { sharedState?: { pixelPerfect?: boolean } } | undefined;
							db.close();
							resolve(record?.sharedState?.pixelPerfect === false);
						};
						get.onerror = () => {
							db.close();
							resolve(false);
						};
					};
					req.onerror = () => resolve(false);
				}),
			null,
			{ timeout: 10_000 }
		);

		// Give the IDB transaction commit a tick to fully settle before the
		// reload tears down the page context; this guards against rare flakes
		// where the newly opened page's restore runs before the write is
		// observable to the fresh connection.
		await page.waitForTimeout(200);

		await page.reload();
		await page
			.getByRole('application', { name: 'Pixel art canvas' })
			.waitFor({ state: 'visible' });

		// After reload, the toggle must still read "Off".
		await expect(page.getByRole('button', { name: 'Pixel Perfect: Off' })).toBeVisible();
	});

	test('toggle is disabled (no-op + disabled label) when tool is not Pencil/Eraser', async ({
		editorPage
	}) => {
		const { canvas, tools, page } = editorPage;
		await canvas.canvasLocator.waitFor({ state: 'visible' });

		// Default tool is Pencil → PP button reads "On".
		const onBtn = page.getByRole('button', { name: 'Pixel Perfect: On' });
		await expect(onBtn).toBeVisible();

		// Switch to Line — PP has no effect for non-freehand tools, so the
		// toggle must render a disabled label and ignore clicks.
		await tools.selectTool('Line');

		const disabledBtn = page.getByRole('button', {
			name: 'Pixel Perfect (Pencil/Eraser only)'
		});
		await expect(disabledBtn).toBeVisible();
		await expect(disabledBtn).toHaveAttribute('aria-disabled', 'true');

		// Click — the disabled toggle must not change shared state. We verify
		// that by switching back to Pencil; the label should still read "On".
		await disabledBtn.click({ force: true });
		await tools.selectTool('Pencil');
		await expect(page.getByRole('button', { name: 'Pixel Perfect: On' })).toBeVisible();
	});

	test('AppBar (compact viewport) toggle flips ON ↔ OFF', async ({ editorPage }) => {
		const { canvas, page } = editorPage;
		await canvas.canvasLocator.waitFor({ state: 'visible' });

		// Shrink to compact viewport so the AppBar renders (<1024px).
		await page.setViewportSize({ width: 390, height: 844 });

		await expect(page.getByRole('button', { name: 'Pixel Perfect: On' })).toBeVisible();
		await page.getByRole('button', { name: 'Pixel Perfect: On' }).click();
		await expect(page.getByRole('button', { name: 'Pixel Perfect: Off' })).toBeVisible();
		await page.getByRole('button', { name: 'Pixel Perfect: Off' }).click();
		await expect(page.getByRole('button', { name: 'Pixel Perfect: On' })).toBeVisible();
	});

	test('Line tool with PP ON paints the diagonal middle pixel (scope boundary)', async ({
		editorPage
	}) => {
		const { canvas, tools, page } = editorPage;
		await canvas.canvasLocator.waitFor({ state: 'visible' });

		const geo = await page.evaluate(readArtGeometry);
		const box = await canvas.canvasLocator.boundingBox();
		if (!box) throw new Error('No bounding box');
		const cssScale = box.width / geo.canvasWidth;

		const aArt = Math.floor(geo.artPixelsAcross / 2);
		const bArt = Math.floor(geo.artPixelsDown / 2);

		const toCss = (artX: number, artY: number) => {
			const canvasX = geo.artLeft + artX * geo.pixelSize + geo.pixelSize / 2;
			const canvasY = geo.artTop + artY * geo.pixelSize + geo.pixelSize / 2;
			return { cssX: canvasX * cssScale, cssY: canvasY * cssScale, canvasX, canvasY };
		};

		// Diagonal line where Bresenham passes through the center art pixel.
		// dx=4, dy=2 → expected path includes the center (aArt, bArt).
		const start = toCss(aArt - 2, bArt - 1);
		const end = toCss(aArt + 2, bArt + 1);
		const mid = toCss(aArt, bArt);

		const initialMidPixel = await page.evaluate(readPixelAt, {
			px: mid.canvasX,
			py: mid.canvasY
		});

		// PP is ON by default; pick Line which should NOT be affected by PP.
		await tools.selectTool('Line');

		await page.mouse.move(box.x + start.cssX, box.y + start.cssY);
		await page.mouse.down();
		await page.mouse.move(box.x + end.cssX, box.y + end.cssY, { steps: 8 });
		await page.mouse.up();

		const midAfter = await page.evaluate(readPixelAt, { px: mid.canvasX, py: mid.canvasY });

		// The middle Bresenham pixel must be painted — PP does NOT engage for
		// shape tools, so the raw Bresenham output is preserved.
		expect(canvas.pixelEquals(midAfter, initialMidPixel)).toBe(false);
	});

	test('L-shape eraser drag preserves the corner middle pixel', async ({ editorPage }) => {
		const { canvas, tools, page } = editorPage;
		await canvas.canvasLocator.waitFor({ state: 'visible' });

		const geo = await page.evaluate(readArtGeometry);
		const box = await canvas.canvasLocator.boundingBox();
		if (!box) throw new Error('No bounding box');
		const cssScale = box.width / geo.canvasWidth;

		const aArt = Math.floor(geo.artPixelsAcross / 2);
		const bArt = Math.floor(geo.artPixelsDown / 2);

		const toCss = (artX: number, artY: number) => {
			const canvasX = geo.artLeft + artX * geo.pixelSize + geo.pixelSize / 2;
			const canvasY = geo.artTop + artY * geo.pixelSize + geo.pixelSize / 2;
			return { cssX: canvasX * cssScale, cssY: canvasY * cssScale, canvasX, canvasY };
		};

		const start = toCss(aArt - 1, bArt);
		const corner = toCss(aArt, bArt);
		const end = toCss(aArt, bArt - 1);

		// Pre-paint the three L-path pixels with discrete pencil clicks. Each
		// click is a single-pixel stroke, so the pencil PP filter has nothing
		// to revert — all three pixels start the erase phase in the painted
		// foreground color.
		await canvas.canvasLocator.click({ position: { x: start.cssX, y: start.cssY } });
		await canvas.canvasLocator.click({ position: { x: corner.cssX, y: corner.cssY } });
		await canvas.canvasLocator.click({ position: { x: end.cssX, y: end.cssY } });

		const paintedStart = await page.evaluate(readPixelAt, { px: start.canvasX, py: start.canvasY });
		const paintedCorner = await page.evaluate(readPixelAt, {
			px: corner.canvasX,
			py: corner.canvasY
		});
		const paintedEnd = await page.evaluate(readPixelAt, { px: end.canvasX, py: end.canvasY });

		// Switch to eraser and drag the same L-shape through the painted pixels.
		await tools.selectTool('Eraser');
		await page.mouse.move(box.x + start.cssX, box.y + start.cssY);
		await page.mouse.down();
		await page.mouse.move(box.x + corner.cssX, box.y + corner.cssY, { steps: 8 });
		await page.mouse.move(box.x + end.cssX, box.y + end.cssY, { steps: 8 });
		await page.mouse.up();

		const startAfter = await page.evaluate(readPixelAt, { px: start.canvasX, py: start.canvasY });
		const cornerAfter = await page.evaluate(readPixelAt, {
			px: corner.canvasX,
			py: corner.canvasY
		});
		const endAfter = await page.evaluate(readPixelAt, { px: end.canvasX, py: end.canvasY });

		// Endpoints erased (color changed from painted state), L-corner middle
		// reverted to its pre-erase painted color (PP filter cancelled the
		// erase at the corner so the L-bump artifact doesn't remain).
		expect(canvas.pixelEquals(startAfter, paintedStart)).toBe(false);
		expect(canvas.pixelEquals(endAfter, paintedEnd)).toBe(false);
		expect(canvas.pixelEquals(cornerAfter, paintedCorner)).toBe(true);
	});
});
