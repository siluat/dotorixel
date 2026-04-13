import { test, expect } from './fixtures';

test.describe('Export', () => {
	test('export popover opens and closes', async ({ editorPage }) => {
		const { page } = editorPage;

		const exportBtn = page.getByRole('button', { name: 'Export' });
		await exportBtn.click();

		const popover = page.locator('.export-popover');
		await expect(popover).toBeVisible();

		// Close with Escape
		await page.keyboard.press('Escape');
		await expect(popover).not.toBeVisible();
	});

	test('default format is PNG', async ({ editorPage }) => {
		const { page } = editorPage;

		await page.getByRole('button', { name: 'Export' }).click();
		const formatSelect = page.locator('#export-format');
		await expect(formatSelect).toHaveValue('png');
	});

	test('changing format updates the confirm button', async ({ editorPage }) => {
		const { page } = editorPage;

		await page.getByRole('button', { name: 'Export' }).click();

		const confirmBtn = page.locator('.export-confirm-btn');
		await expect(confirmBtn).toContainText('PNG');

		await page.locator('#export-format').selectOption('svg');
		await expect(confirmBtn).toContainText('SVG');
	});

	test('custom filename appears in the input', async ({ editorPage }) => {
		const { page } = editorPage;

		await page.getByRole('button', { name: 'Export' }).click();

		const filenameInput = page.locator('#export-filename');
		await expect(filenameInput).toHaveAttribute('placeholder', /dotorixel-16x16/);

		await filenameInput.fill('my-pixel-art');
		await expect(filenameInput).toHaveValue('my-pixel-art');
	});

	test('export triggers a download with correct filename', async ({ editorPage }) => {
		const { page } = editorPage;

		await page.getByRole('button', { name: 'Export' }).click();
		await page.locator('#export-filename').fill('test-export');

		const downloadPromise = page.waitForEvent('download');
		await page.locator('.export-confirm-btn').click();
		const download = await downloadPromise;

		expect(download.suggestedFilename()).toBe('test-export.png');
	});

	test('SVG export triggers download with .svg extension', async ({ editorPage }) => {
		const { page } = editorPage;

		await page.getByRole('button', { name: 'Export' }).click();
		await page.locator('#export-format').selectOption('svg');
		await page.locator('#export-filename').fill('test-svg');

		const downloadPromise = page.waitForEvent('download');
		await page.locator('.export-confirm-btn').click();
		const download = await downloadPromise;

		expect(download.suggestedFilename()).toBe('test-svg.svg');
	});
});
