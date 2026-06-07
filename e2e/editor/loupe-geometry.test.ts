import { test, expect } from './fixtures';
import { LOUPE_HEIGHT, LOUPE_WIDTH } from '../../src/lib/canvas/sampling/loupe-config';

/**
 * Real-browser guard for the Loupe geometry contract (issue #162).
 *
 * The unit test reconstructs the box from the custom properties the component
 * emits, but happy-dom does no layout — only a real browser confirms the CSS
 * actually consumes those properties and renders the box at the size
 * `computeLoupePosition` assumes. These are that "measured box = computed
 * totals" check, and the edge case it exists to protect (on-screen clamping).
 */
test.describe('Loupe geometry contract', () => {
	test('renders at exactly LOUPE_WIDTH × LOUPE_HEIGHT while sampling', async ({ editorPage }) => {
		const { canvas, tools, page } = editorPage;
		const loupe = page.locator('[data-testid="loupe-root"]');

		const box = await canvas.canvasLocator.boundingBox();
		if (!box) throw new Error('Canvas not found');

		await tools.selectTool('Eyedropper');

		// Press-and-hold at the canvas center so the sampling session opens the
		// loupe; a small move fires the pointer update that positions it.
		const x = box.x + box.width / 2;
		const y = box.y + box.height / 2;
		await page.mouse.move(x, y);
		await page.mouse.down();
		await page.mouse.move(x + 10, y, { steps: 2 });
		await expect(loupe).toBeVisible();

		const loupeBox = await loupe.boundingBox();
		await page.mouse.up();

		expect(loupeBox).not.toBeNull();
		// The rendered border-box must equal the totals the position math uses.
		expect(Math.round(loupeBox!.width)).toBe(LOUPE_WIDTH);
		expect(Math.round(loupeBox!.height)).toBe(LOUPE_HEIGHT);
	});

	test('stays fully within the viewport when sampling near the top edge', async ({
		editorPage
	}) => {
		const { canvas, tools, page } = editorPage;
		const viewport = page.viewportSize();
		if (!viewport) throw new Error('No viewport');
		const loupe = page.locator('[data-testid="loupe-root"]');

		const box = await canvas.canvasLocator.boundingBox();
		if (!box) throw new Error('Canvas not found');

		await tools.selectTool('Eyedropper');

		// Sample near the canvas top: the default quadrant places the loupe above
		// the pointer, which would clip the top — computeLoupePosition must flip it
		// below and keep it on-screen. This holds only if the rendered height
		// matches the LOUPE_HEIGHT the math clamps with.
		const x = box.x + box.width / 2;
		const y = box.y + box.height * 0.05;
		await page.mouse.move(x, y);
		await page.mouse.down();
		await page.mouse.move(x + 10, y, { steps: 2 });
		await expect(loupe).toBeVisible();

		const loupeBox = await loupe.boundingBox();
		await page.mouse.up();

		expect(loupeBox).not.toBeNull();
		expect(loupeBox!.x).toBeGreaterThanOrEqual(0);
		expect(loupeBox!.y).toBeGreaterThanOrEqual(0);
		expect(loupeBox!.x + loupeBox!.width).toBeLessThanOrEqual(viewport.width);
		expect(loupeBox!.y + loupeBox!.height).toBeLessThanOrEqual(viewport.height);
	});
});
