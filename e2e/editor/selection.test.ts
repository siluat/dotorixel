import { test, expect, readArtGeometry } from './fixtures';
import type { Page } from '@playwright/test';

interface PixelColor {
	r: number;
	g: number;
	b: number;
	a: number;
}

function readPixelAt({ px, py }: { px: number; py: number }): PixelColor {
	const canvas = document.querySelector<HTMLCanvasElement>('canvas.pixel-canvas');
	if (!canvas) throw new Error('Canvas not found');
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('No 2d context');
	const p = ctx.getImageData(px, py, 1, 1).data;
	return { r: p[0], g: p[1], b: p[2], a: p[3] };
}

/**
 * Normalize `readArtGeometry` to art-pixel space. The renderer's default
 * sub-checker mode reports two checker tiles per art pixel, so the checker
 * period must be doubled and the per-axis count halved for art-pixel math.
 * Mirrors `pixel-perfect.test.ts`.
 */
function normalizeArtGrid(geo: {
	pixelSize: number;
	artPixelsAcross: number;
	artPixelsDown: number;
}): { artPixelCss: number; artPixelsAcross: number; artPixelsDown: number } {
	expect(geo.artPixelsAcross % 2).toBe(0);
	return {
		artPixelCss: geo.pixelSize * 2,
		artPixelsAcross: Math.floor(geo.artPixelsAcross / 2),
		artPixelsDown: Math.floor(geo.artPixelsDown / 2)
	};
}

function samePixel(a: PixelColor, b: PixelColor): boolean {
	return a.r === b.r && a.g === b.g && a.b === b.b && a.a === b.a;
}

interface ArtPoint {
	cssX: number;
	cssY: number;
	canvasX: number;
	canvasY: number;
}

/**
 * Drive the Floating Selection setup shared by the tests: paint the `src` art
 * pixel, define a 2x1 Marquee (`src`..`marqueeEnd`) so `src` sits inside it,
 * then drag from `src` to `dst` to lift and move the Floating Selection. A 1x1
 * Marquee is intentionally avoided — the Selection tool treats a same-pixel
 * drag as no movement and never opens a Marquee.
 */
async function floatPaintedPixel(
	page: Page,
	selectTool: (name: string) => Promise<void>,
	boxX: number,
	boxY: number,
	src: ArtPoint,
	marqueeEnd: ArtPoint,
	dst: ArtPoint
): Promise<{ bgSrc: PixelColor; painted: PixelColor; readArt: (p: ArtPoint) => Promise<PixelColor> }> {
	const readArt = (p: ArtPoint) => page.evaluate(readPixelAt, { px: p.canvasX, py: p.canvasY });

	const bgSrc = await readArt(src);

	// Paint the source pixel with the pencil (default tool).
	await page.mouse.move(boxX + src.cssX, boxY + src.cssY);
	await page.mouse.down();
	await page.mouse.up();
	const painted = await readArt(src);
	expect(samePixel(painted, bgSrc)).toBe(false);

	// Define a 2x1 Marquee covering the source pixel with the Selection tool.
	await selectTool('Selection');
	await page.mouse.move(boxX + src.cssX, boxY + src.cssY);
	await page.mouse.down();
	await page.mouse.move(boxX + marqueeEnd.cssX, boxY + marqueeEnd.cssY, { steps: 4 });
	await page.mouse.up();

	// Drag from inside the Marquee to the destination: lift + move the Floating Selection.
	await page.mouse.move(boxX + src.cssX, boxY + src.cssY);
	await page.mouse.down();
	await page.mouse.move(boxX + dst.cssX, boxY + dst.cssY, { steps: 6 });
	await page.mouse.up();

	return { bgSrc, painted, readArt };
}

test.describe('Selection — Floating Selection', () => {
	test('lift, drag, and commit moves a painted pixel; undo restores it', async ({ editorPage }) => {
		const { canvas, tools, page } = editorPage;
		await canvas.canvasLocator.waitFor({ state: 'visible' });

		const geo = await page.evaluate(readArtGeometry);
		const box = await canvas.canvasLocator.boundingBox();
		if (!box) throw new Error('No bounding box');
		const cssScale = box.width / geo.canvasWidth;
		const { artPixelCss, artPixelsAcross, artPixelsDown } = normalizeArtGrid(geo);

		const toCss = (artX: number, artY: number): ArtPoint => {
			const canvasX = geo.artLeft + artX * artPixelCss + artPixelCss / 2;
			const canvasY = geo.artTop + artY * artPixelCss + artPixelCss / 2;
			return { cssX: canvasX * cssScale, cssY: canvasY * cssScale, canvasX, canvasY };
		};

		const sx = Math.floor(artPixelsAcross / 2);
		const sy = Math.floor(artPixelsDown / 2);
		const src = toCss(sx, sy);
		const marqueeEnd = toCss(sx + 1, sy);
		const dst = toCss(sx + 2, sy);

		const bgDst = await page.evaluate(readPixelAt, { px: dst.canvasX, py: dst.canvasY });
		const { bgSrc, painted, readArt } = await floatPaintedPixel(
			page,
			(n) => tools.selectTool(n),
			box.x,
			box.y,
			src,
			marqueeEnd,
			dst
		);

		// The source clears back to its background; the pixel now floats at the destination.
		expect(samePixel(await readArt(src), bgSrc)).toBe(true);
		expect(samePixel(await readArt(dst), painted)).toBe(true);

		// Switching to a drawing tool and drawing commits the Floating Selection first;
		// the moved pixel stays at the destination.
		await tools.selectTool('Pencil');
		const far = toCss(sx - 3, sy);
		await page.mouse.move(box.x + far.cssX, box.y + far.cssY);
		await page.mouse.down();
		await page.mouse.up();
		expect(samePixel(await readArt(dst), painted)).toBe(true);

		// Undo the pencil dot, then the Floating commit: the pixel returns to source.
		await page.keyboard.press('ControlOrMeta+z');
		await page.keyboard.press('ControlOrMeta+z');
		expect(samePixel(await readArt(src), painted)).toBe(true);
		expect(samePixel(await readArt(dst), bgDst)).toBe(true);
	});

	test('Escape cancels an uncommitted Floating Selection drag and restores the source', async ({
		editorPage
	}) => {
		const { canvas, tools, page } = editorPage;
		await canvas.canvasLocator.waitFor({ state: 'visible' });

		const geo = await page.evaluate(readArtGeometry);
		const box = await canvas.canvasLocator.boundingBox();
		if (!box) throw new Error('No bounding box');
		const cssScale = box.width / geo.canvasWidth;
		const { artPixelCss, artPixelsAcross, artPixelsDown } = normalizeArtGrid(geo);

		const toCss = (artX: number, artY: number): ArtPoint => {
			const canvasX = geo.artLeft + artX * artPixelCss + artPixelCss / 2;
			const canvasY = geo.artTop + artY * artPixelCss + artPixelCss / 2;
			return { cssX: canvasX * cssScale, cssY: canvasY * cssScale, canvasX, canvasY };
		};

		const sx = Math.floor(artPixelsAcross / 2);
		const sy = Math.floor(artPixelsDown / 2);
		const src = toCss(sx, sy);
		const marqueeEnd = toCss(sx + 1, sy);
		const dst = toCss(sx + 2, sy);

		const bgDst = await page.evaluate(readPixelAt, { px: dst.canvasX, py: dst.canvasY });
		const { bgSrc, painted, readArt } = await floatPaintedPixel(
			page,
			(n) => tools.selectTool(n),
			box.x,
			box.y,
			src,
			marqueeEnd,
			dst
		);

		expect(samePixel(await readArt(src), bgSrc)).toBe(true);
		expect(samePixel(await readArt(dst), painted)).toBe(true);

		// Escape cancels the Floating Selection: the pixel returns to its source.
		await page.keyboard.press('Escape');
		expect(samePixel(await readArt(src), painted)).toBe(true);
		expect(samePixel(await readArt(dst), bgDst)).toBe(true);
	});
});
