import { test, expect } from './fixtures';

test.describe('Transport — in-editor playback', () => {
	test('plays the animation, advances the playhead, and pausing returns to the active frame with no undo entry', async ({
		editorPage
	}) => {
		const { page, canvas, history } = editorPage;

		const ruler = page.locator('[data-frame-ruler-cell]');
		const play = page.locator('[data-transport-play]');
		const loop = page.locator('[data-transport-loop]');
		const marker = page.locator('[data-playhead-marker]');

		// Single frame: nothing to animate, so Play is disabled.
		await expect(ruler).toHaveCount(1);
		await expect(play).toBeDisabled();

		// Author two frames with distinct content: frame 1 drawn, frame 2 left blank
		// (and active). The blank center of frame 2 is what the canvas returns to.
		await canvas.clickCanvas();
		const drawn = await canvas.readPixelAtCenter();
		await page.locator('[data-add-frame]').click();
		await expect(ruler).toHaveCount(2);
		await expect(ruler.nth(1)).toHaveAttribute('aria-current', 'true');
		const activeBlank = await canvas.readPixelAtCenter();
		expect(canvas.pixelEquals(activeBlank, drawn)).toBe(false);

		// Two frames now: Play is enabled.
		await expect(play).toBeEnabled();

		// Loop on so playback keeps cycling (observable), then press Play.
		await loop.click();
		await expect(loop).toHaveAttribute('aria-pressed', 'true');
		await play.click();
		await expect(play).toHaveAttribute('aria-pressed', 'true');

		// The playhead advances to the second frame — asserted on a stable data
		// attribute (the ▾ marker's ordinal), not a pixel-diff race.
		await expect(
			page.locator('[data-playhead-marker][data-playhead-ordinal="2"]')
		).toHaveCount(1);

		// Playback drives the canvas itself: while cycling it shows frame 1's drawn
		// content — proof the playhead composite reaches the screen, not just the marker.
		await expect
			.poll(async () => canvas.pixelEquals(await canvas.readPixelAtCenter(), drawn))
			.toBe(true);

		// Pause → playback stops, the marker disappears, and the display returns to the
		// Active Frame (frame 2, still blank), which never moved during playback.
		await play.click();
		await expect(play).toHaveAttribute('aria-pressed', 'false');
		await expect(marker).toHaveCount(0);
		await expect(ruler.nth(1)).toHaveAttribute('aria-current', 'true');
		await expect
			.poll(async () => canvas.pixelEquals(await canvas.readPixelAtCenter(), activeBlank))
			.toBe(true);

		// Playback created no undo entry: the first undo reverts the real last edit
		// (add frame 2 → back to one frame), not a phantom playback step.
		await history.undo();
		await expect(ruler).toHaveCount(1);
	});
});
