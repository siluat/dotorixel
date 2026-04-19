import { test, expect, readArtGeometry } from './fixtures';

function readPixelAt({ px, py }: { px: number; py: number }) {
	const canvas = document.querySelector<HTMLCanvasElement>('canvas.pixel-canvas');
	if (!canvas) throw new Error('Canvas not found');
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('No 2d context');
	const p = ctx.getImageData(px, py, 1, 1).data;
	return { r: p[0], g: p[1], b: p[2], a: p[3] };
}

test.describe('Pixel Perfect', () => {
	test('L-shape pencil drag reverts the corner middle pixel', async ({ editorPage }) => {
		const { canvas, page } = editorPage;
		await canvas.canvasLocator.waitFor({ state: 'visible' });

		const geo = await page.evaluate(readArtGeometry);
		const box = await canvas.canvasLocator.boundingBox();
		if (!box) throw new Error('No bounding box');
		const cssScale = box.width / geo.canvasWidth;

		// Pick three adjacent art pixels forming an L: (a-1, b) → (a, b) → (a, b-1).
		// Aim near the canvas center to stay safely inside bounds.
		const aArt = Math.floor(geo.artPixelsAcross / 2);
		const bArt = Math.floor(geo.artPixelsDown / 2);

		// Convert art-pixel index to internal canvas coords (pixel center), then to CSS.
		const toCss = (artX: number, artY: number) => {
			const canvasX = geo.artLeft + artX * geo.pixelSize + geo.pixelSize / 2;
			const canvasY = geo.artTop + artY * geo.pixelSize + geo.pixelSize / 2;
			return { cssX: canvasX * cssScale, cssY: canvasY * cssScale, canvasX, canvasY };
		};

		const start = toCss(aArt - 1, bArt);
		const corner = toCss(aArt, bArt);
		const end = toCss(aArt, bArt - 1);

		const initialCornerPixel = await page.evaluate(readPixelAt, { px: corner.canvasX, py: corner.canvasY });
		const initialStartPixel = await page.evaluate(readPixelAt, { px: start.canvasX, py: start.canvasY });
		const initialEndPixel = await page.evaluate(readPixelAt, { px: end.canvasX, py: end.canvasY });

		// Continuous L-shape drag.
		await page.mouse.move(box.x + start.cssX, box.y + start.cssY);
		await page.mouse.down();
		await page.mouse.move(box.x + corner.cssX, box.y + corner.cssY, { steps: 8 });
		await page.mouse.move(box.x + end.cssX, box.y + end.cssY, { steps: 8 });
		await page.mouse.up();

		const startAfter = await page.evaluate(readPixelAt, { px: start.canvasX, py: start.canvasY });
		const cornerAfter = await page.evaluate(readPixelAt, { px: corner.canvasX, py: corner.canvasY });
		const endAfter = await page.evaluate(readPixelAt, { px: end.canvasX, py: end.canvasY });

		// Endpoints painted, L-corner middle reverted to its initial color.
		expect(canvas.pixelEquals(startAfter, initialStartPixel)).toBe(false);
		expect(canvas.pixelEquals(endAfter, initialEndPixel)).toBe(false);
		expect(canvas.pixelEquals(cornerAfter, initialCornerPixel)).toBe(true);
	});

	test('L-shape eraser drag preserves the corner middle pixel', async ({ editorPage }) => {
		const { canvas, tools, page } = editorPage;
		await canvas.canvasLocator.waitFor({ state: 'visible' });

		const geo = await page.evaluate(readArtGeometry);
		const box = await canvas.canvasLocator.boundingBox();
		if (!box) throw new Error('No bounding box');
		const cssScale = box.width / geo.canvasWidth;

		const aArt = Math.floor(geo.artPixelsAcross / 2);
		const bArt = Math.floor(geo.artPixelsDown / 2);

		const toCss = (artX: number, artY: number) => {
			const canvasX = geo.artLeft + artX * geo.pixelSize + geo.pixelSize / 2;
			const canvasY = geo.artTop + artY * geo.pixelSize + geo.pixelSize / 2;
			return { cssX: canvasX * cssScale, cssY: canvasY * cssScale, canvasX, canvasY };
		};

		const start = toCss(aArt - 1, bArt);
		const corner = toCss(aArt, bArt);
		const end = toCss(aArt, bArt - 1);

		// Pre-paint the three L-path pixels with discrete pencil clicks. Each
		// click is a single-pixel stroke, so the pencil PP filter has nothing
		// to revert — all three pixels start the erase phase in the painted
		// foreground color.
		await canvas.canvasLocator.click({ position: { x: start.cssX, y: start.cssY } });
		await canvas.canvasLocator.click({ position: { x: corner.cssX, y: corner.cssY } });
		await canvas.canvasLocator.click({ position: { x: end.cssX, y: end.cssY } });

		const paintedStart = await page.evaluate(readPixelAt, { px: start.canvasX, py: start.canvasY });
		const paintedCorner = await page.evaluate(readPixelAt, {
			px: corner.canvasX,
			py: corner.canvasY
		});
		const paintedEnd = await page.evaluate(readPixelAt, { px: end.canvasX, py: end.canvasY });

		// Switch to eraser and drag the same L-shape through the painted pixels.
		await tools.selectTool('Eraser');
		await page.mouse.move(box.x + start.cssX, box.y + start.cssY);
		await page.mouse.down();
		await page.mouse.move(box.x + corner.cssX, box.y + corner.cssY, { steps: 8 });
		await page.mouse.move(box.x + end.cssX, box.y + end.cssY, { steps: 8 });
		await page.mouse.up();

		const startAfter = await page.evaluate(readPixelAt, { px: start.canvasX, py: start.canvasY });
		const cornerAfter = await page.evaluate(readPixelAt, {
			px: corner.canvasX,
			py: corner.canvasY
		});
		const endAfter = await page.evaluate(readPixelAt, { px: end.canvasX, py: end.canvasY });

		// Endpoints erased (color changed from painted state), L-corner middle
		// reverted to its pre-erase painted color (PP filter cancelled the
		// erase at the corner so the L-bump artifact doesn't remain).
		expect(canvas.pixelEquals(startAfter, paintedStart)).toBe(false);
		expect(canvas.pixelEquals(endAfter, paintedEnd)).toBe(false);
		expect(canvas.pixelEquals(cornerAfter, paintedCorner)).toBe(true);
	});
});
