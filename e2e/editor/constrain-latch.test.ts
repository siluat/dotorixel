import { test, expect } from './fixtures';

test.describe('Constrain latch', () => {
	test('re-tapping the active Line tool arms the latch on the touch layout', async ({
		editorPage
	}) => {
		const { canvas, page } = editorPage;
		await expect(canvas.canvasLocator).toBeVisible();

		// Touch layout (<1024px): select Line, then re-tap it to arm the latch.
		await page.setViewportSize({ width: 390, height: 844 });
		await page.getByRole('button', { name: 'Line', exact: true }).click();
		await page.getByRole('button', { name: 'Line', exact: true }).click();

		await expect(page.getByRole('button', { name: 'Line (Constrain)' })).toBeVisible();
	});

	test('re-clicking the active Line tool arms and disarms the latch in the docked layout', async ({
		editorPage
	}) => {
		const { canvas, page } = editorPage;
		await expect(canvas.canvasLocator).toBeVisible();

		// Default viewport (1280×720) renders the docked layout.
		await page.getByRole('button', { name: 'Line', exact: true }).click();
		await page.getByRole('button', { name: 'Line', exact: true }).click();
		await expect(page.getByRole('button', { name: 'Line (Constrain)' })).toBeVisible();

		await page.getByRole('button', { name: 'Line (Constrain)' }).click();
		await expect(page.getByRole('button', { name: 'Line', exact: true })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Line (Constrain)' })).toHaveCount(0);
	});

	test('an armed latch survives layout changes and stays clearable everywhere', async ({
		editorPage
	}) => {
		const { canvas, page } = editorPage;
		await expect(canvas.canvasLocator).toBeVisible();

		// Arm on the touch layout.
		await page.setViewportSize({ width: 390, height: 844 });
		await page.getByRole('button', { name: 'Line', exact: true }).click();
		await page.getByRole('button', { name: 'Line', exact: true }).click();
		await expect(page.getByRole('button', { name: 'Line (Constrain)' })).toBeVisible();

		// Crossing into docked (≥1024px): the latch is one shared workspace state,
		// so it stays armed and visible — and clearable right there.
		await page.setViewportSize({ width: 1280, height: 720 });
		await expect(page.locator('.editor-docked')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Line (Constrain)' })).toBeVisible();

		await page.getByRole('button', { name: 'Line (Constrain)' }).click();
		await expect(page.getByRole('button', { name: 'Line', exact: true })).toBeVisible();

		// Back on the touch layout the disarm is reflected too.
		await page.setViewportSize({ width: 390, height: 844 });
		await expect(page.getByRole('button', { name: 'Line', exact: true })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Line (Constrain)' })).toHaveCount(0);
	});
});
