import { test, expect, waitForSessionRestored } from './fixtures';

test.describe('Frame panel — operations', () => {
	test('add a frame, draw on it, switch frames to see the canvas differ, and undo restores', async ({
		editorPage
	}) => {
		const { page, canvas, history } = editorPage;

		const ruler = page.locator('[data-frame-ruler-cell]');
		await expect(ruler).toHaveCount(1);

		// The blank center pixel of the starting frame (transparent → checkerboard).
		const blank = await canvas.readPixelAtCenter();

		// Add a frame: a second, empty frame is inserted and becomes active.
		await page.locator('[data-add-frame]').click();
		await expect(ruler).toHaveCount(2);
		await expect(ruler.nth(1)).toHaveAttribute('aria-current', 'true');

		// The new frame is blank and ready to draw.
		expect(canvas.pixelEquals(await canvas.readPixelAtCenter(), blank)).toBe(true);

		// Draw distinct content on the active (second) frame.
		await canvas.clickCanvas();
		const drawn = await canvas.readPixelAtCenter();
		expect(canvas.pixelEquals(drawn, blank)).toBe(false);

		// Switch to frame 1 → its center is still blank, so the canvas differs.
		await ruler.nth(0).click();
		await expect(ruler.nth(0)).toHaveAttribute('aria-current', 'true');
		await expect
			.poll(async () => canvas.pixelEquals(await canvas.readPixelAtCenter(), blank))
			.toBe(true);

		// Switch back to frame 2 → the drawn pixel is preserved (per-cel content).
		await ruler.nth(1).click();
		await expect
			.poll(async () => canvas.pixelEquals(await canvas.readPixelAtCenter(), drawn))
			.toBe(true);

		// Undo the stroke → frame 2's center is blank again. Frame switching never
		// entered history, so the single undo lands on the draw.
		await history.undo();
		await expect
			.poll(async () => canvas.pixelEquals(await canvas.readPixelAtCenter(), blank))
			.toBe(true);
	});

	test('duplicate copies the active frame’s content into a new active frame', async ({
		editorPage
	}) => {
		const { page, canvas } = editorPage;
		const ruler = page.locator('[data-frame-ruler-cell]');

		// Draw on frame 1, then duplicate it.
		await canvas.clickCanvas();
		const drawn = await canvas.readPixelAtCenter();

		await page.locator('[data-duplicate-frame]').click();
		await expect(ruler).toHaveCount(2);
		await expect(ruler.nth(1)).toHaveAttribute('aria-current', 'true');

		// The duplicate (now active) carries the same center pixel — unlike add,
		// which would land on a blank frame.
		await expect
			.poll(async () => canvas.pixelEquals(await canvas.readPixelAtCenter(), drawn))
			.toBe(true);
	});

	test('delete is disabled at one frame, removes the active frame otherwise, and is undoable', async ({
		editorPage
	}) => {
		const { page, history } = editorPage;
		const ruler = page.locator('[data-frame-ruler-cell]');
		const deleteBtn = page.locator('[data-remove-frame]');

		// Disabled while only one frame remains, so the Document is never frameless.
		await expect(ruler).toHaveCount(1);
		await expect(deleteBtn).toBeDisabled();

		await page.locator('[data-add-frame]').click();
		await expect(ruler).toHaveCount(2);
		await expect(deleteBtn).toBeEnabled();

		// Delete the active frame → an adjacent frame becomes active.
		await deleteBtn.click();
		await expect(ruler).toHaveCount(1);
		await expect(ruler.nth(0)).toHaveAttribute('aria-current', 'true');

		// Delete is a single undo step.
		await history.undo();
		await expect(ruler).toHaveCount(2);
	});

	test('dragging a ruler cell reorders frames and keeps the active frame active', async ({
		editorPage
	}) => {
		const { page, canvas } = editorPage;
		const ruler = page.locator('[data-frame-ruler-cell]');

		// Frame 1 gets content; add an empty frame 2, which becomes active and blank.
		await canvas.clickCanvas();
		const drawn = await canvas.readPixelAtCenter();
		await page.locator('[data-add-frame]').click();
		await expect(ruler).toHaveCount(2);
		await expect(ruler.nth(1)).toHaveAttribute('aria-current', 'true');
		const blank = await canvas.readPixelAtCenter();
		expect(canvas.pixelEquals(blank, drawn)).toBe(false);

		// Drag frame 1's ruler cell right past frame 2 → frame 1 moves to index 1.
		const box = await ruler.nth(0).boundingBox();
		if (!box) throw new Error('Frame ruler cell has no bounding box');
		const startX = box.x + box.width / 2;
		const y = box.y + box.height / 2;
		await page.mouse.move(startX, y);
		await page.mouse.down();
		await page.mouse.move(startX + box.width * 1.5, y, { steps: 5 });
		await page.mouse.up();

		// Order is now [frame 2 (blank), frame 1 (content)]. The previously-active
		// frame 2 stays active (it shifted to position 1) and still shows blank.
		await expect(ruler.nth(0)).toHaveAttribute('aria-current', 'true');
		await expect
			.poll(async () => canvas.pixelEquals(await canvas.readPixelAtCenter(), blank))
			.toBe(true);

		// Position 2 now holds the content-bearing frame 1.
		await ruler.nth(1).click();
		await expect
			.poll(async () => canvas.pixelEquals(await canvas.readPixelAtCenter(), drawn))
			.toBe(true);
	});

	test('new frames and their per-cel pixels survive a page refresh', async ({ editorPage }) => {
		const { page, canvas } = editorPage;
		const ruler = page.locator('[data-frame-ruler-cell]');

		// Frame 1 stays blank; add frame 2 and draw distinct content on it.
		const blank = await canvas.readPixelAtCenter();
		await page.locator('[data-add-frame]').click();
		await expect(ruler).toHaveCount(2);
		await canvas.clickCanvas();
		const drawn = await canvas.readPixelAtCenter();
		expect(canvas.pixelEquals(drawn, blank)).toBe(false);

		// Return to frame 1 so the active-frame pointer is exercised across reload too.
		await ruler.nth(0).click();
		await expect(ruler.nth(0)).toHaveAttribute('aria-current', 'true');

		// Wait for the debounced auto-save to persist two frames, then reload. Polling
		// the record (rather than a fixed wait) avoids racing the IndexedDB commit.
		await page.waitForFunction(
			() =>
				new Promise<boolean>((resolve) => {
					const req = indexedDB.open('dotorixel');
					req.onsuccess = () => {
						const db = req.result;
						const getAll = db.transaction('documents', 'readonly').objectStore('documents').getAll();
						getAll.onsuccess = () => {
							const docs = getAll.result as Array<{ frames?: unknown[] }>;
							db.close();
							resolve(docs.some((d) => Array.isArray(d.frames) && d.frames.length === 2));
						};
						getAll.onerror = () => {
							db.close();
							resolve(false);
						};
					};
					req.onerror = () => resolve(false);
				}),
			null,
			{ timeout: 10_000 }
		);
		await page.waitForTimeout(200);

		await page.reload();
		await page.getByRole('application', { name: 'Pixel art canvas' }).waitFor({ state: 'visible' });
		await waitForSessionRestored(page);

		// Both frames came back; frame 1 (the restored active frame) is blank and
		// frame 2 still carries its drawn cel.
		const rulerAfter = page.locator('[data-frame-ruler-cell]');
		await expect(rulerAfter).toHaveCount(2);
		await expect(rulerAfter.nth(0)).toHaveAttribute('aria-current', 'true');
		await expect
			.poll(async () => canvas.pixelEquals(await canvas.readPixelAtCenter(), blank))
			.toBe(true);

		await rulerAfter.nth(1).click();
		await expect
			.poll(async () => canvas.pixelEquals(await canvas.readPixelAtCenter(), drawn))
			.toBe(true);
	});
});
