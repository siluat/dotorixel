import { test, expect } from './fixtures';

test.describe('Layer panel — add layer', () => {
	test('clicking the add-layer button appends a new active layer with a localized default name at the top of the panel', async ({
		editorPage
	}) => {
		const { page } = editorPage;

		const rowsBefore = page.locator('[data-layer-row]');
		await expect(rowsBefore).toHaveCount(1);
		await expect(rowsBefore.first()).toHaveText(/Layer 1/);

		await page.locator('[data-add-layer]').click();

		const rowsAfter = page.locator('[data-layer-row]');
		await expect(rowsAfter).toHaveCount(2);
		// New layer is z-top, which the panel renders at the top row.
		await expect(rowsAfter.nth(0)).toHaveAttribute('aria-current', 'true');
		await expect(rowsAfter.nth(0)).toHaveText(/Layer 2/);
		await expect(rowsAfter.nth(1)).toHaveText(/Layer 1/);
	});

	test('the counter advances monotonically — clicking three times yields the panel order Layer 4 / 3 / 2 / 1 (top → bottom)', async ({
		editorPage
	}) => {
		const { page } = editorPage;
		const addBtn = page.locator('[data-add-layer]');

		await addBtn.click();
		await addBtn.click();
		await addBtn.click();

		const rows = page.locator('[data-layer-row]');
		await expect(rows).toHaveCount(4);
		await expect(rows.nth(0)).toHaveText(/Layer 4/);
		await expect(rows.nth(1)).toHaveText(/Layer 3/);
		await expect(rows.nth(2)).toHaveText(/Layer 2/);
		await expect(rows.nth(3)).toHaveText(/Layer 1/);
	});

	test('add is undoable and redoable', async ({ editorPage }) => {
		const { page, history } = editorPage;

		await page.locator('[data-add-layer]').click();
		await expect(page.locator('[data-layer-row]')).toHaveCount(2);

		await history.undo();
		await expect(page.locator('[data-layer-row]')).toHaveCount(1);

		await history.redo();
		await expect(page.locator('[data-layer-row]')).toHaveCount(2);
	});
});
