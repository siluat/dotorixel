import { test, expect } from './fixtures';

test.describe('History (Undo/Redo)', () => {
	test('undo enables after drawing', async ({ editorPage }) => {
		const { canvas, history } = editorPage;

		expect(await history.canUndo()).toBe(false);
		await canvas.clickCanvas();
		expect(await history.canUndo()).toBe(true);
	});

	test('undo reverts drawing', async ({ editorPage }) => {
		const { canvas, history } = editorPage;

		const original = await canvas.readPixelAtCenter();
		await canvas.clickCanvas();
		const drawn = await canvas.readPixelAtCenter();
		expect(canvas.pixelEquals(original, drawn)).toBe(false);

		await history.undo();
		const undone = await canvas.readPixelAtCenter();
		expect(canvas.pixelEquals(original, undone)).toBe(true);
	});

	test('redo restores undone drawing', async ({ editorPage }) => {
		const { canvas, history } = editorPage;

		await canvas.clickCanvas();
		const drawn = await canvas.readPixelAtCenter();

		await history.undo();
		await history.redo();
		const redone = await canvas.readPixelAtCenter();

		expect(canvas.pixelEquals(drawn, redone)).toBe(true);
	});

	test('new drawing disables redo', async ({ editorPage }) => {
		const { canvas, history } = editorPage;

		await canvas.clickCanvas();
		await history.undo();
		expect(await history.canRedo()).toBe(true);

		// New drawing should clear the redo stack
		await canvas.clickCanvas();
		expect(await history.canRedo()).toBe(false);
	});

	test('keyboard shortcuts: Ctrl+Z and Ctrl+Shift+Z', async ({ editorPage }) => {
		const { canvas, history, page } = editorPage;

		await canvas.clickCanvas();
		expect(await history.canUndo()).toBe(true);

		await page.keyboard.press('Control+z');
		expect(await history.canUndo()).toBe(false);
		expect(await history.canRedo()).toBe(true);

		await page.keyboard.press('Control+Shift+z');
		expect(await history.canUndo()).toBe(true);
		expect(await history.canRedo()).toBe(false);
	});

	test('multiple undo and redo steps', async ({ editorPage }) => {
		const { canvas, tools, history } = editorPage;

		const original = await canvas.readPixelAtCenter();

		// Draw 3 strokes (pencil, then change color via palette for visible difference)
		await canvas.clickCanvas();
		await tools.selectTool('Eraser');
		await canvas.clickCanvas();
		await tools.selectTool('Pencil');
		await canvas.clickCanvas();

		// Undo all 3
		await history.undo();
		await history.undo();
		await history.undo();
		expect(await history.canUndo()).toBe(false);

		const afterAllUndo = await canvas.readPixelAtCenter();
		expect(canvas.pixelEquals(original, afterAllUndo)).toBe(true);

		// Redo all 3
		await history.redo();
		await history.redo();
		await history.redo();
		expect(await history.canRedo()).toBe(false);
	});
});
