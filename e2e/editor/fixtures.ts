import { test as base, expect, type Page, type Locator } from '@playwright/test';

interface PixelColor {
	r: number;
	g: number;
	b: number;
	a: number;
}

function pixelColorsEqual(a: PixelColor, b: PixelColor): boolean {
	return a.r === b.r && a.g === b.g && a.b === b.b && a.a === b.a;
}

/** Find the art canvas center in internal canvas coords and its CSS-space equivalent. */
function findArtCenter(): { canvasX: number; canvasY: number; cssX: number; cssY: number } {
	const canvas = document.querySelector<HTMLCanvasElement>('canvas.pixel-canvas');
	if (!canvas) throw new Error('Canvas not found');
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('No 2d context');
	const rect = canvas.getBoundingClientRect();

	// Scan for opaque pixel bounds (the art canvas area within the viewport canvas)
	let artLeft = -1;
	for (let x = 0; x < canvas.width; x++) {
		if (ctx.getImageData(x, 10, 1, 1).data[3] > 0) { artLeft = x; break; }
	}
	let artRight = -1;
	for (let x = canvas.width - 1; x >= 0; x--) {
		if (ctx.getImageData(x, 10, 1, 1).data[3] > 0) { artRight = x; break; }
	}
	const scanX = artLeft >= 0 ? artLeft + 5 : 5;
	let artTop = -1;
	for (let y = 0; y < canvas.height; y++) {
		if (ctx.getImageData(scanX, y, 1, 1).data[3] > 0) { artTop = y; break; }
	}
	let artBottom = -1;
	for (let y = canvas.height - 1; y >= 0; y--) {
		if (ctx.getImageData(scanX, y, 1, 1).data[3] > 0) { artBottom = y; break; }
	}

	if (artLeft < 0 || artTop < 0) throw new Error('Art canvas area not found');

	// Find the effective pixel size by detecting the first color transition
	// along the top row of the art area. The checkerboard alternates per art pixel:
	// pixel 0 is one color, pixel 1 is another. The transition point = pixelSize.
	const firstColor = ctx.getImageData(artLeft, artTop, 1, 1).data;
	let pixelSize = artRight - artLeft + 1; // fallback: single-pixel canvas
	for (let x = artLeft + 1; x <= artRight; x++) {
		const p = ctx.getImageData(x, artTop, 1, 1).data;
		if (p[0] !== firstColor[0] || p[1] !== firstColor[1] || p[2] !== firstColor[2]) {
			pixelSize = x - artLeft;
			break;
		}
	}

	// Click/read the center of the center art pixel to avoid grid lines.
	// Grid lines are on art pixel boundaries (multiples of pixelSize).
	const artPixelCount = Math.round((artRight - artLeft + 1) / pixelSize);
	const centerIdx = Math.floor(artPixelCount / 2);
	const canvasX = Math.round(artLeft + centerIdx * pixelSize + pixelSize / 2);
	const canvasY = Math.round(artTop + centerIdx * pixelSize + pixelSize / 2);
	const cssX = Math.round(canvasX * (rect.width / canvas.width));
	const cssY = Math.round(canvasY * (rect.height / canvas.height));
	return { canvasX, canvasY, cssX, cssY };
}

function readPixelAt({ px, py }: { px: number; py: number }): PixelColor {
	const canvas = document.querySelector<HTMLCanvasElement>('canvas.pixel-canvas');
	if (!canvas) throw new Error('Canvas not found');
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('No 2d context');
	const pixel = ctx.getImageData(px, py, 1, 1).data;
	return { r: pixel[0], g: pixel[1], b: pixel[2], a: pixel[3] };
}

interface CanvasHelpers {
	canvasLocator: Locator;
	/** Click the art canvas center. */
	clickCanvas(): Promise<void>;
	/** Drag across the canvas between two CSS offsets. */
	dragCanvas(from: { x: number; y: number }, to: { x: number; y: number }): Promise<void>;
	/** Read pixel at the same position where clickCanvas() clicks. */
	readPixelAtCenter(): Promise<PixelColor>;
	/** Compare two pixel colors for equality. */
	pixelEquals(a: PixelColor, b: PixelColor): boolean;
}

interface ToolHelpers {
	selectTool(name: string): Promise<void>;
	getActiveTool(): Promise<string>;
}

interface HistoryHelpers {
	undo(): Promise<void>;
	redo(): Promise<void>;
	canUndo(): Promise<boolean>;
	canRedo(): Promise<boolean>;
}

interface EditorPage {
	page: Page;
	canvas: CanvasHelpers;
	tools: ToolHelpers;
	history: HistoryHelpers;
}

function createCanvasHelpers(page: Page): CanvasHelpers {
	const canvasLocator = page.getByRole('application', { name: 'Pixel art canvas' });

	async function getArtCenter() {
		await canvasLocator.waitFor({ state: 'visible' });
		// Retry until the art area is rendered (tab switch may delay rendering)
		for (let attempt = 0; attempt < 10; attempt++) {
			try {
				return await page.evaluate(findArtCenter);
			} catch {
				await page.waitForTimeout(100);
			}
		}
		return page.evaluate(findArtCenter);
	}

	return {
		canvasLocator,

		async clickCanvas() {
			const center = await getArtCenter();
			await canvasLocator.click({ position: { x: center.cssX, y: center.cssY } });
		},

		async dragCanvas(from, to) {
			const box = await canvasLocator.boundingBox();
			if (!box) throw new Error('Canvas not found');
			await page.mouse.move(box.x + from.x, box.y + from.y);
			await page.mouse.down();
			await page.mouse.move(box.x + to.x, box.y + to.y, { steps: 5 });
			await page.mouse.up();
		},

		async readPixelAtCenter() {
			const center = await getArtCenter();
			return page.evaluate(readPixelAt, { px: center.canvasX, py: center.canvasY });
		},

		pixelEquals: pixelColorsEqual,
	};
}

function createToolHelpers(page: Page): ToolHelpers {
	return {
		async selectTool(name) {
			await page.getByRole('button', { name, exact: true }).click();
		},

		async getActiveTool() {
			const activeBtn = page.locator('.tool-btn[aria-pressed="true"]');
			const label = await activeBtn.getAttribute('aria-label');
			return label ?? '';
		},
	};
}

function createHistoryHelpers(page: Page): HistoryHelpers {
	return {
		async undo() {
			await page.getByRole('button', { name: 'Undo' }).click();
		},

		async redo() {
			await page.getByRole('button', { name: 'Redo' }).click();
		},

		async canUndo() {
			return page.getByRole('button', { name: 'Undo' }).isEnabled();
		},

		async canRedo() {
			return page.getByRole('button', { name: 'Redo' }).isEnabled();
		},
	};
}

export const test = base.extend<{ editorPage: EditorPage }>({
	editorPage: async ({ page }, use) => {
		await page.goto('/editor');
		await page
			.getByRole('application', { name: 'Pixel art canvas' })
			.waitFor({ state: 'visible' });

		await use({
			page,
			canvas: createCanvasHelpers(page),
			tools: createToolHelpers(page),
			history: createHistoryHelpers(page),
		});
	},
});

export { expect };
