import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

const TINY_PNG_BUFFER = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
	'base64'
);

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

test.describe('Layer panel — Reference Layer import', () => {
	async function importReferenceLayer(page: Page, name: string) {
		const chooserPromise = page.waitForEvent('filechooser');
		await page.locator('[data-add-reference-layer]').click();
		const chooser = await chooserPromise;
		await chooser.setFiles({
			name,
			mimeType: 'image/png',
			buffer: TINY_PNG_BUFFER
		});
	}

	test('imports a Reference Layer as the active fixed-bottom row without changing the Pixel add flow', async ({
		editorPage
	}) => {
		const { page } = editorPage;

		await importReferenceLayer(page, 'sketch.png');

		const rows = page.locator('[data-layer-row]');
		await expect(rows).toHaveCount(2);
		await expect(rows.nth(0)).toHaveText(/Layer 1/);
		await expect(rows.nth(0).locator('[data-layer-kind-icon]')).toHaveAttribute(
			'data-layer-kind',
			'pixel'
		);
		await expect(rows.nth(1)).toHaveText(/sketch\.png/);
		await expect(rows.nth(1)).toHaveAttribute('aria-current', 'true');
		await expect(rows.nth(1).locator('[data-layer-kind-icon]')).toHaveAttribute(
			'data-layer-kind',
			'reference'
		);
		await expect(rows.nth(1).locator('[data-reorder-handle]')).toHaveCount(0);

		await page.locator('[data-add-layer]').click();
		await expect(rows).toHaveCount(3);
		await expect(rows.nth(0)).toHaveText(/Layer 1/);
		await expect(rows.nth(1)).toHaveText(/Layer \d+/);
		await expect(rows.nth(1).locator('[data-layer-kind-icon]')).toHaveAttribute(
			'data-layer-kind',
			'pixel'
		);
		await expect(rows.nth(1)).toHaveAttribute('aria-current', 'true');
		await expect(rows.nth(2)).toHaveText(/sketch\.png/);
	});

	test('asks before replacing an existing Reference Layer and keeps the document singleton', async ({
		editorPage
	}) => {
		const { page } = editorPage;

		await importReferenceLayer(page, 'first.png');

		await page.locator('[data-add-reference-layer]').click();
		const dialog = page.getByRole('alertdialog', { name: 'Replace Reference Layer?' });
		await expect(dialog).toBeVisible();
		await dialog.getByRole('button', { name: 'Cancel' }).click();
		await expect(dialog).not.toBeVisible();
		await expect(page.locator('[data-layer-row]')).toHaveCount(2);
		await expect(page.locator('[data-layer-row]').nth(1)).toHaveText(/first\.png/);

		await page.locator('[data-add-reference-layer]').click();
		await expect(dialog).toBeVisible();
		const chooserPromise = page.waitForEvent('filechooser');
		await dialog.getByRole('button', { name: 'Replace' }).click();
		const chooser = await chooserPromise;
		await chooser.setFiles({
			name: 'second.png',
			mimeType: 'image/png',
			buffer: TINY_PNG_BUFFER
		});

		const rows = page.locator('[data-layer-row]');
		await expect(rows).toHaveCount(2);
		await expect(rows.nth(1)).toHaveText(/second\.png/);
		await expect(rows.nth(1)).not.toHaveText(/first\.png/);
		await expect(rows.nth(1)).toHaveAttribute('aria-current', 'true');
	});
});

test.describe('Layer panel — remove layer', () => {
	test('remove button is disabled when only one layer remains', async ({ editorPage }) => {
		const { page } = editorPage;

		const rows = page.locator('[data-layer-row]');
		await expect(rows).toHaveCount(1);
		const removeBtn = rows.first().locator('[data-remove-layer]');
		await expect(removeBtn).toBeDisabled();
	});

	test('clicking remove drops that row and the panel reflects the new stack', async ({
		editorPage
	}) => {
		const { page } = editorPage;

		await page.locator('[data-add-layer]').click();
		await page.locator('[data-add-layer]').click();
		const rowsAfterAdd = page.locator('[data-layer-row]');
		await expect(rowsAfterAdd).toHaveCount(3);
		// Panel order is z-top → z-bottom: Layer 3 / 2 / 1
		await expect(rowsAfterAdd.nth(0)).toHaveText(/Layer 3/);
		await expect(rowsAfterAdd.nth(1)).toHaveText(/Layer 2/);
		await expect(rowsAfterAdd.nth(2)).toHaveText(/Layer 1/);

		// Remove the middle row (Layer 2).
		await rowsAfterAdd.nth(1).locator('[data-remove-layer]').click();

		const rowsAfterRemove = page.locator('[data-layer-row]');
		await expect(rowsAfterRemove).toHaveCount(2);
		await expect(rowsAfterRemove.nth(0)).toHaveText(/Layer 3/);
		await expect(rowsAfterRemove.nth(1)).toHaveText(/Layer 1/);
	});

	test('removing the active layer reassigns active to an adjacent layer', async ({
		editorPage
	}) => {
		const { page } = editorPage;

		await page.locator('[data-add-layer]').click();
		const rows = page.locator('[data-layer-row]');
		await expect(rows).toHaveCount(2);
		// Newly-added Layer 2 is active and sits at the top row.
		await expect(rows.nth(0)).toHaveAttribute('aria-current', 'true');

		await rows.nth(0).locator('[data-remove-layer]').click();

		const remaining = page.locator('[data-layer-row]');
		await expect(remaining).toHaveCount(1);
		await expect(remaining.first()).toHaveAttribute('aria-current', 'true');
		await expect(remaining.first()).toHaveText(/Layer 1/);
	});

	test('clicking the remove button does not activate the row underneath', async ({
		editorPage
	}) => {
		const { page } = editorPage;

		await page.locator('[data-add-layer]').click();
		const rows = page.locator('[data-layer-row]');
		await expect(rows).toHaveCount(2);
		// Active starts on the newly-added Layer 2 (top row).
		await expect(rows.nth(0)).toHaveAttribute('aria-current', 'true');

		// Remove the non-active bottom row; active must stay on Layer 2 (top).
		await rows.nth(1).locator('[data-remove-layer]').click();

		const remaining = page.locator('[data-layer-row]');
		await expect(remaining).toHaveCount(1);
		await expect(remaining.first()).toHaveText(/Layer 2/);
		await expect(remaining.first()).toHaveAttribute('aria-current', 'true');
	});

	test('remove is undoable and redoable', async ({ editorPage }) => {
		const { page, history } = editorPage;

		await page.locator('[data-add-layer]').click();
		await expect(page.locator('[data-layer-row]')).toHaveCount(2);

		await page
			.locator('[data-layer-row]')
			.nth(1)
			.locator('[data-remove-layer]')
			.click();
		await expect(page.locator('[data-layer-row]')).toHaveCount(1);

		await history.undo();
		await expect(page.locator('[data-layer-row]')).toHaveCount(2);

		await history.redo();
		await expect(page.locator('[data-layer-row]')).toHaveCount(1);
	});
});

test.describe('Layer panel — activate layer on row click', () => {
	test('clicking a non-active row makes it active, and the activation is not in history', async ({
		editorPage
	}) => {
		const { page, history } = editorPage;

		await page.locator('[data-add-layer]').click();
		const rows = page.locator('[data-layer-row]');
		await expect(rows).toHaveCount(2);
		await expect(rows.nth(0)).toHaveAttribute('aria-current', 'true');

		await rows.nth(1).click();

		await expect(rows.nth(1)).toHaveAttribute('aria-current', 'true');
		await expect(rows.nth(0)).not.toHaveAttribute('aria-current', 'true');

		await history.undo();
		await expect(page.locator('[data-layer-row]')).toHaveCount(1);
	});
});
