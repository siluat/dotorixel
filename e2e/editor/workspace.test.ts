import { test, expect } from './fixtures';

test.describe('Workspace (Tabs)', () => {
	test('starts with one tab named Untitled 1', async ({ editorPage }) => {
		const { page } = editorPage;

		const tabs = page.getByRole('tab');
		await expect(tabs).toHaveCount(1);
		await expect(tabs.first()).toContainText('Untitled 1');
		await expect(tabs.first()).toHaveAttribute('aria-selected', 'true');
	});

	test('add tab creates a new tab', async ({ editorPage }) => {
		const { page } = editorPage;

		await page.getByRole('button', { name: 'New tab' }).click();

		const tabs = page.getByRole('tab');
		await expect(tabs).toHaveCount(2);
		await expect(tabs.nth(1)).toContainText('Untitled 2');
		await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
	});

	test('switching tabs changes the active tab', async ({ editorPage }) => {
		const { page } = editorPage;

		await page.getByRole('button', { name: 'New tab' }).click();
		const tabs = page.getByRole('tab');

		// Switch to first tab
		await tabs.first().click();
		await expect(tabs.first()).toHaveAttribute('aria-selected', 'true');
		await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'false');

		// Switch back to second tab
		await tabs.nth(1).click();
		await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
	});

	test('closing a blank tab does not show save dialog', async ({ editorPage }) => {
		const { page } = editorPage;

		// Add a second tab so we can close one
		await page.getByRole('button', { name: 'New tab' }).click();
		await expect(page.getByRole('tab')).toHaveCount(2);

		// Close the second tab (blank)
		await page.getByRole('button', { name: 'Close Untitled 2' }).click();

		await expect(page.getByRole('tab')).toHaveCount(1);
		await expect(page.getByRole('dialog')).toHaveCount(0);
	});

	test('closing a modified tab shows save dialog', async ({ editorPage }) => {
		const { canvas, page } = editorPage;

		// Draw on the first tab (already loaded and canvas is ready)
		await canvas.clickCanvas();

		// Add a second tab so we can close the first
		await page.getByRole('button', { name: 'New tab' }).click();
		await expect(page.getByRole('tab')).toHaveCount(2);

		// Try to close the first (modified) tab
		await page.getByRole('button', { name: 'Close Untitled 1' }).click();

		const dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible();
		await expect(dialog.locator('#save-dialog-title')).toHaveText('Save your work?');
	});

	test('save dialog — Save closes tab and dialog', async ({ editorPage }) => {
		const { canvas, page } = editorPage;

		await canvas.clickCanvas();
		await page.getByRole('button', { name: 'New tab' }).click();

		await page.getByRole('button', { name: 'Close Untitled 1' }).click();

		const dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible();

		await dialog.locator('#save-dialog-name').fill('My Drawing');
		await dialog.getByRole('button', { name: 'Save' }).click();

		await expect(dialog).not.toBeVisible();
		await expect(page.getByRole('tab')).toHaveCount(1);
	});

	test('save dialog — Delete closes tab without saving', async ({ editorPage }) => {
		const { canvas, page } = editorPage;

		await canvas.clickCanvas();
		await page.getByRole('button', { name: 'New tab' }).click();

		await page.getByRole('button', { name: 'Close Untitled 1' }).click();

		const dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible();

		await dialog.getByRole('button', { name: 'Delete' }).click();

		await expect(dialog).not.toBeVisible();
		await expect(page.getByRole('tab')).toHaveCount(1);
	});

	test('save dialog — Cancel keeps tab open', async ({ editorPage }) => {
		const { canvas, page } = editorPage;

		await canvas.clickCanvas();
		await page.getByRole('button', { name: 'New tab' }).click();

		await page.getByRole('button', { name: 'Close Untitled 1' }).click();

		const dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible();

		await dialog.getByRole('button', { name: 'Cancel' }).click();

		await expect(dialog).not.toBeVisible();
		await expect(page.getByRole('tab')).toHaveCount(2);
	});
});
