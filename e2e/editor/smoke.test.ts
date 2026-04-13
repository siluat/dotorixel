import { test, expect } from './fixtures';

test.describe('Editor smoke', () => {
	test('loads with canvas visible and default state', async ({ editorPage }) => {
		const { canvas, tools, history } = editorPage;

		await expect(canvas.canvasLocator).toBeVisible();
		expect(await tools.getActiveTool()).toBe('Pencil');
		expect(await history.canUndo()).toBe(false);
		expect(await history.canRedo()).toBe(false);
	});
});
