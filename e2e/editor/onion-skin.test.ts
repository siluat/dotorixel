import { test, expect, waitForSessionRestored } from './fixtures';

test.describe('Onion Skin — adjacent-frame ghosts', () => {
	test('ghosts the neighbor frame while enabled, returns to background when disabled, and the toggle survives a reload', async ({
		editorPage
	}) => {
		const { page, canvas } = editorPage;

		const ruler = page.locator('[data-frame-ruler-cell]');
		const onionSkin = page.locator('[data-transport-onion-skin]');

		// Single frame: no neighbors to ghost, so the toggle shares the strip's
		// disabled convention.
		await expect(ruler).toHaveCount(1);
		await expect(onionSkin).toBeDisabled();

		// Author two frames with distinct content: frame 1 drawn at the center,
		// frame 2 blank (and active). The blank center is the background the
		// ghost must appear over — and return to.
		await canvas.clickCanvas();
		await page.locator('[data-add-frame]').click();
		await expect(ruler).toHaveCount(2);
		await expect(ruler.nth(1)).toHaveAttribute('aria-current', 'true');
		const background = await canvas.readPixelAtCenter();

		// Enable: the previous frame's art shows through as a ghost where only
		// the neighbor has art.
		await onionSkin.click();
		await expect(onionSkin).toHaveAttribute('aria-pressed', 'true');
		await expect
			.poll(async () => canvas.pixelEquals(await canvas.readPixelAtCenter(), background))
			.toBe(false);

		// Disable: the ghost vanishes and the center returns to the background.
		await onionSkin.click();
		await expect(onionSkin).toHaveAttribute('aria-pressed', 'false');
		await expect
			.poll(async () => canvas.pixelEquals(await canvas.readPixelAtCenter(), background))
			.toBe(true);

		// Re-enable, then wait for the debounced auto-save to commit both the
		// two-frame document and the workspace viewport flag. Polling the records
		// (rather than a fixed wait) avoids racing the IndexedDB commit.
		await onionSkin.click();
		await expect(onionSkin).toHaveAttribute('aria-pressed', 'true');
		await page.waitForFunction(
			() =>
				new Promise<boolean>((resolve) => {
					const req = indexedDB.open('dotorixel');
					req.onsuccess = () => {
						const db = req.result;
						const tx = db.transaction(['documents', 'workspace'], 'readonly');
						const getDocs = tx.objectStore('documents').getAll();
						const getWorkspaces = tx.objectStore('workspace').getAll();
						tx.oncomplete = () => {
							const docs = getDocs.result as Array<{ frames?: unknown[] }>;
							const workspaces = getWorkspaces.result as Array<{
								viewports?: Record<string, { showOnionSkin?: boolean }>;
							}>;
							db.close();
							resolve(
								docs.some((doc) => Array.isArray(doc.frames) && doc.frames.length === 2) &&
									workspaces.some((record) =>
										Object.values(record.viewports ?? {}).some(
											(viewport) => viewport.showOnionSkin === true
										)
									)
							);
						};
						tx.onerror = () => {
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

		// The toggle state was restored — and so is the ghost on the canvas.
		await expect(page.locator('[data-transport-onion-skin]')).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		await expect
			.poll(async () => canvas.pixelEquals(await canvas.readPixelAtCenter(), background))
			.toBe(false);
	});
});
