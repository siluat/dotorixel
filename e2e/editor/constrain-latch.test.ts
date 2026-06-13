import { test, expect } from './fixtures';

const CONSTRAIN_ON = 'Constrain is on. Activate this tool again to turn it off.';
const CONSTRAIN_OFF = 'Constrain is off. Activate this tool again to turn it on.';

test.describe('Constrain latch', () => {
	test('re-tapping the active Line tool arms the latch on the touch layout', async ({
		editorPage
	}) => {
		const { canvas, page } = editorPage;
		await expect(canvas.canvasLocator).toBeVisible();

		// Touch layout (<1024px): select Line, then re-tap it to arm the latch.
		await page.setViewportSize({ width: 390, height: 844 });
		const line = page.getByRole('radio', { name: 'Line', exact: true });
		await line.click();
		await expect(page.getByRole('status')).toHaveText(CONSTRAIN_OFF);

		await line.click();
		await expect(page.getByRole('status')).toHaveText(CONSTRAIN_ON);
		await expect(line).toHaveAttribute('aria-checked', 'true');
	});

	test('re-clicking the active Line tool arms and disarms the latch in the docked layout', async ({
		editorPage
	}) => {
		const { canvas, page } = editorPage;
		await expect(canvas.canvasLocator).toBeVisible();

		// Default viewport (1280×720) renders the docked layout.
		const line = page.getByRole('radio', { name: 'Line', exact: true });
		await line.click();
		await line.click();
		await expect(page.getByRole('status')).toHaveText(CONSTRAIN_ON);

		await line.click();
		await expect(page.getByRole('status')).toHaveText(CONSTRAIN_OFF);
	});

	test('Space on the focused active tool arms the latch without leaking to canvas pan', async ({
		editorPage
	}) => {
		const { canvas, page } = editorPage;
		await expect(canvas.canvasLocator).toBeVisible();

		// Activating with the keyboard is the equivalent of a re-tap; the radiogroup
		// consumes Space so the window-level pan shortcut never sees it.
		const line = page.getByRole('radio', { name: 'Line', exact: true });
		await line.click();
		await line.focus();
		await page.keyboard.press('Space');

		await expect(page.getByRole('status')).toHaveText(CONSTRAIN_ON);
		await expect(line).toHaveAttribute('aria-checked', 'true');
	});

	test('an armed latch survives layout changes and stays clearable everywhere', async ({
		editorPage
	}) => {
		const { canvas, page } = editorPage;
		await expect(canvas.canvasLocator).toBeVisible();

		// Arm on the touch layout.
		await page.setViewportSize({ width: 390, height: 844 });
		const line = page.getByRole('radio', { name: 'Line', exact: true });
		await line.click();
		await line.click();
		await expect(page.getByRole('status')).toHaveText(CONSTRAIN_ON);

		// Crossing into docked (≥1024px): the latch is one shared session state,
		// so it stays armed and announced — and clearable right there.
		await page.setViewportSize({ width: 1280, height: 720 });
		await expect(page.locator('.editor-docked')).toBeVisible();
		await expect(page.getByRole('status')).toHaveText(CONSTRAIN_ON);

		await page.getByRole('radio', { name: 'Line', exact: true }).click();
		await expect(page.getByRole('status')).toHaveText(CONSTRAIN_OFF);

		// Back on the touch layout the disarm is reflected too.
		await page.setViewportSize({ width: 390, height: 844 });
		await expect(page.getByRole('status')).toHaveText(CONSTRAIN_OFF);
	});
});
