import { test, expect } from './fixtures';

test.describe('Canvas settings', () => {
	test('grid toggle via button', async ({ editorPage }) => {
		const { page } = editorPage;

		const gridBtn = page.getByRole('button', { name: 'Toggle Grid' });
		await expect(gridBtn).toHaveAttribute('aria-pressed', 'true');

		await gridBtn.click();
		await expect(gridBtn).toHaveAttribute('aria-pressed', 'false');

		await gridBtn.click();
		await expect(gridBtn).toHaveAttribute('aria-pressed', 'true');
	});

	test('grid toggle via keyboard shortcut', async ({ editorPage }) => {
		const { page } = editorPage;

		const gridBtn = page.getByRole('button', { name: 'Toggle Grid' });
		await expect(gridBtn).toHaveAttribute('aria-pressed', 'true');

		await page.keyboard.press('g');
		await expect(gridBtn).toHaveAttribute('aria-pressed', 'false');

		await page.keyboard.press('g');
		await expect(gridBtn).toHaveAttribute('aria-pressed', 'true');
	});

	test('zoom in and out changes zoom percentage', async ({ editorPage }) => {
		const { page } = editorPage;

		const zoomLabel = page.getByRole('button', { name: 'Reset zoom to 100%' });
		const initialText = await zoomLabel.textContent();

		await page.getByRole('button', { name: 'Zoom In' }).click();
		const zoomedIn = await zoomLabel.textContent();
		expect(zoomedIn).not.toBe(initialText);

		await page.getByRole('button', { name: 'Zoom Out' }).click();
		const zoomedBack = await zoomLabel.textContent();
		expect(zoomedBack).toBe(initialText);
	});

	test('zoom reset returns to default', async ({ editorPage }) => {
		const { page } = editorPage;

		const zoomLabel = page.getByRole('button', { name: 'Reset zoom to 100%' });

		// Zoom in twice
		await page.getByRole('button', { name: 'Zoom In' }).click();
		await page.getByRole('button', { name: 'Zoom In' }).click();

		// Reset
		await zoomLabel.click();
		await expect(zoomLabel).toHaveText('100%');
	});

	test('canvas size changes via preset button', async ({ editorPage }) => {
		const { page } = editorPage;

		const statusSize = page.locator('.status-size');
		await expect(statusSize).toContainText('16');

		// Click the 32 preset button
		const preset32 = page.locator('.preset-btn', { hasText: '32' });
		await preset32.click();

		await expect(statusSize).toContainText('32 \u00D7 32');
	});

	test('canvas size changes via custom input', async ({ editorPage }) => {
		const { page } = editorPage;

		const widthInput = page.locator('input[title="Canvas width"]');
		const heightInput = page.locator('input[title="Canvas height"]');
		const statusSize = page.locator('.status-size');

		await widthInput.fill('24');
		await widthInput.press('Enter');

		await heightInput.fill('24');
		await heightInput.press('Enter');

		await expect(statusSize).toContainText('24 \u00D7 24');
	});
});
