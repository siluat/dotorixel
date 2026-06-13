import { test, expect } from './fixtures';

const TOUCH_MIN = 44;
const CONSTRAIN_ON = 'Constrain is on. Activate this tool again to turn it off.';
const CONSTRAIN_OFF = 'Constrain is off. Activate this tool again to turn it on.';

test.describe('Toolbar touch targets', () => {
	test('every compact strip button meets the 44px touch minimum with Undo always visible', async ({
		editorPage
	}) => {
		const { canvas, page } = editorPage;
		await expect(canvas.canvasLocator).toBeVisible();

		// Phone width: the strip cannot fit 9 tools + Undo at 44px, so tools scroll
		// while Undo stays pinned — but no button may shrink below the touch minimum.
		await page.setViewportSize({ width: 390, height: 844 });

		const strip = page.locator('.tool-strip');
		await expect(strip).toBeVisible();
		const tools = strip.getByRole('radio');
		const toolCount = await tools.count();
		expect(toolCount).toBe(9);
		for (let i = 0; i < toolCount; i++) {
			const box = await tools.nth(i).boundingBox();
			expect(box).not.toBeNull();
			expect(box!.width).toBeGreaterThanOrEqual(TOUCH_MIN);
			expect(box!.height).toBeGreaterThanOrEqual(TOUCH_MIN);
		}

		const undo = strip.getByRole('button', { name: 'Undo' });
		const undoBox = await undo.boundingBox();
		expect(undoBox).not.toBeNull();
		expect(undoBox!.width).toBeGreaterThanOrEqual(TOUCH_MIN);
		expect(undoBox!.height).toBeGreaterThanOrEqual(TOUCH_MIN);
		// Pinned: fully inside the 390px viewport without any scrolling.
		expect(undoBox!.x).toBeGreaterThanOrEqual(0);
		expect(undoBox!.x + undoBox!.width).toBeLessThanOrEqual(390);
	});

	test('all nine tools are reachable by horizontally scrolling the compact strip', async ({
		editorPage
	}) => {
		const { canvas, page } = editorPage;
		await expect(canvas.canvasLocator).toBeVisible();

		await page.setViewportSize({ width: 390, height: 844 });
		const group = page.locator('.tool-strip .tool-group');
		await expect(group).toBeVisible();

		// The strip overflows at phone width — the tool area must actually scroll.
		const { scrollWidth, clientWidth } = await group.evaluate((el) => ({
			scrollWidth: el.scrollWidth,
			clientWidth: el.clientWidth
		}));
		expect(scrollWidth).toBeGreaterThan(clientWidth);

		// The last tool starts clipped; scrolling the group brings it fully into view.
		const lastTool = page.locator('.tool-strip [role=radio]').last();
		await lastTool.scrollIntoViewIfNeeded();
		const groupBox = (await group.boundingBox())!;
		const lastBox = (await lastTool.boundingBox())!;
		expect(lastBox.x).toBeGreaterThanOrEqual(groupBox.x - 0.5);
		expect(lastBox.x + lastBox.width).toBeLessThanOrEqual(groupBox.x + groupBox.width + 0.5);

		// And it is genuinely interactive once scrolled in.
		await lastTool.click();
		await expect(lastTool).toHaveAttribute('aria-checked', 'true');
	});

	test('the medium strip fits without scrolling and keeps Redo visible', async ({
		editorPage
	}) => {
		const { canvas, page } = editorPage;
		await expect(canvas.canvasLocator).toBeVisible();

		// Medium (≥600px): everything fits, so no tool is clipped and Redo reappears.
		await page.setViewportSize({ width: 768, height: 1024 });
		const strip = page.locator('.tool-strip');
		await expect(strip).toBeVisible();
		const stripBox = (await strip.boundingBox())!;

		const tools = strip.getByRole('radio');
		const toolCount = await tools.count();
		expect(toolCount).toBe(9);
		for (let i = 0; i < toolCount; i++) {
			const box = (await tools.nth(i).boundingBox())!;
			expect(box.width).toBeGreaterThanOrEqual(TOUCH_MIN);
			// Fully within the strip — nothing is clipped into a scroll area.
			expect(box.x).toBeGreaterThanOrEqual(stripBox.x - 0.5);
			expect(box.x + box.width).toBeLessThanOrEqual(stripBox.x + stripBox.width + 0.5);
		}

		await expect(strip.getByRole('button', { name: 'Redo' })).toBeVisible();
	});

	test('docked LeftToolbar tool and action buttons present 44px hit areas', async ({
		editorPage
	}) => {
		const { canvas, page } = editorPage;
		await expect(canvas.canvasLocator).toBeVisible();

		// Default viewport (1280×720) renders the docked layout with the LeftToolbar.
		const toolbar = page.locator('.left-toolbar');
		await expect(toolbar).toBeVisible();

		const buttons = toolbar.locator('button');
		const count = await buttons.count();
		expect(count).toBeGreaterThan(0);
		for (let i = 0; i < count; i++) {
			const box = (await buttons.nth(i).boundingBox())!;
			expect(box.width).toBeGreaterThanOrEqual(TOUCH_MIN);
			expect(box.height).toBeGreaterThanOrEqual(TOUCH_MIN);
		}
	});

	test('the docked LeftToolbar strip does not overflow horizontally', async ({ editorPage }) => {
		const { canvas, page } = editorPage;
		await expect(canvas.canvasLocator).toBeVisible();

		// The strip column must hold the 44px button plus its 1px divider border:
		// a too-narrow column would clip the button and spawn a horizontal scrollbar.
		for (const width of [1280, 1440]) {
			await page.setViewportSize({ width, height: 800 });
			const toolbar = page.locator('.left-toolbar');
			await expect(toolbar).toBeVisible();
			const { scrollWidth, clientWidth } = await toolbar.evaluate((el) => ({
				scrollWidth: el.scrollWidth,
				clientWidth: el.clientWidth
			}));
			expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
		}
	});

	test('a constrainable tool scrolled into view still toggles its latch when re-tapped', async ({
		editorPage
	}) => {
		const { canvas, page } = editorPage;
		await expect(canvas.canvasLocator).toBeVisible();

		await page.setViewportSize({ width: 390, height: 844 });
		await expect(page.locator('.tool-strip')).toBeVisible();

		// Selection is the last tool — it starts clipped past the scroll boundary.
		const selection = page.getByRole('radio', { name: 'Selection', exact: true });
		await selection.scrollIntoViewIfNeeded();

		await selection.click();
		await expect(page.getByRole('status')).toHaveText(CONSTRAIN_OFF);

		// Re-tapping the active tool after scrolling still arms the latch.
		await selection.click();
		await expect(page.getByRole('status')).toHaveText(CONSTRAIN_ON);
		await expect(selection).toHaveAttribute('aria-checked', 'true');

		// The corner dot rides the scrolled-in tool and stays visible within the strip.
		const badge = page.locator('.tool-strip .constrain-badge');
		await expect(badge).toBeVisible();
		const stripBox = (await page.locator('.tool-strip').boundingBox())!;
		const badgeBox = (await badge.boundingBox())!;
		expect(badgeBox.x).toBeGreaterThanOrEqual(stripBox.x - 0.5);
		expect(badgeBox.x + badgeBox.width).toBeLessThanOrEqual(stripBox.x + stripBox.width + 0.5);
	});
});
