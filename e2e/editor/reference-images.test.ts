import { test, expect, waitForSessionRestored } from './fixtures';
import type { Page, Locator } from '@playwright/test';

// 1×1 transparent PNG, base64 — small enough to inline as a fixture.
const TINY_PNG_BASE64 =
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

// `.window` is the floating ReferenceWindow; scoping under `.overlay`
// distinguishes it from any unrelated `.window` elsewhere on the page.
const REFERENCE_WINDOW_SELECTOR = '.overlay .window';

async function dropFilesOnto(
	page: Page,
	target: Locator,
	files: { name: string; type: string; base64: string }[],
	offset?: { x: number; y: number }
) {
	const handle = await target.elementHandle();
	if (!handle) throw new Error('Drop target not found');

	const box = await target.boundingBox();
	if (!box) throw new Error('Drop target has no bounding box');
	const localX = offset?.x ?? Math.round(box.width / 2);
	const localY = offset?.y ?? Math.round(box.height / 2);
	const clientX = Math.round(box.x + localX);
	const clientY = Math.round(box.y + localY);

	const dataTransfer = await page.evaluateHandle((files) => {
		const dt = new DataTransfer();
		for (const f of files) {
			const bytes = Uint8Array.from(atob(f.base64), (c) => c.charCodeAt(0));
			dt.items.add(new File([bytes], f.name, { type: f.type }));
		}
		return dt;
	}, files);

	await handle.dispatchEvent('dragenter', { dataTransfer, clientX, clientY });
	await handle.dispatchEvent('dragover', { dataTransfer, clientX, clientY });
	await handle.dispatchEvent('drop', { dataTransfer, clientX, clientY });
}

async function openReferencesModal(page: Page) {
	await page.getByRole('button', { name: 'Open references' }).click();
	await page.getByRole('dialog', { name: 'References' }).waitFor({ state: 'visible' });
}

test.describe('Reference images — drag-and-drop import', () => {
	test('canvas drop adds to gallery and immediately displays a floating window', async ({
		editorPage
	}) => {
		const { page } = editorPage;

		const canvasArea = page.locator('.canvas-area').first();
		await dropFilesOnto(
			page,
			canvasArea,
			[{ name: 'pose.png', type: 'image/png', base64: TINY_PNG_BASE64 }],
			{ x: 200, y: 150 }
		);

		await expect(page.locator(REFERENCE_WINDOW_SELECTOR)).toHaveCount(1);

		await openReferencesModal(page);
		await expect(page.locator('.card')).toHaveCount(1);
	});

	test('modal drop adds to gallery without displaying a floating window', async ({
		editorPage
	}) => {
		const { page } = editorPage;

		await openReferencesModal(page);
		const modal = page.getByRole('dialog', { name: 'References' });

		await dropFilesOnto(page, modal, [
			{ name: 'sketch.png', type: 'image/png', base64: TINY_PNG_BASE64 }
		]);

		await expect(modal.locator('.card')).toHaveCount(1);
		await page.keyboard.press('Escape');
		await expect(page.locator(REFERENCE_WINDOW_SELECTOR)).toHaveCount(0);
	});

	test('multi-file canvas drop cascades windows from the drop point', async ({ editorPage }) => {
		const { page } = editorPage;

		const canvasArea = page.locator('.canvas-area').first();
		await dropFilesOnto(
			page,
			canvasArea,
			[
				{ name: 'a.png', type: 'image/png', base64: TINY_PNG_BASE64 },
				{ name: 'b.png', type: 'image/png', base64: TINY_PNG_BASE64 }
			],
			{ x: 220, y: 180 }
		);

		const windows = page.locator(REFERENCE_WINDOW_SELECTOR);
		await expect(windows).toHaveCount(2);

		const first = await windows.nth(0).boundingBox();
		const second = await windows.nth(1).boundingBox();
		if (!first || !second) throw new Error('Reference windows missing bounding box');
		expect(Math.round(second.x - first.x)).toBe(24);
		expect(Math.round(second.y - first.y)).toBe(24);
	});

	test('rejected files surface validation errors in the modal', async ({ editorPage }) => {
		const { page } = editorPage;

		await openReferencesModal(page);
		const modal = page.getByRole('dialog', { name: 'References' });

		await dropFilesOnto(page, modal, [
			{ name: 'vector.svg', type: 'image/svg+xml', base64: TINY_PNG_BASE64 }
		]);

		await expect(modal.getByRole('alert')).toContainText('vector.svg');
		await expect(modal.locator('.card')).toHaveCount(0);
	});
});

test.describe('Reference images — round-trip persistence', () => {
	test('window position survives a page reload', async ({ editorPage }) => {
		const { page } = editorPage;

		const canvasArea = page.locator('.canvas-area').first();
		await dropFilesOnto(
			page,
			canvasArea,
			[{ name: 'restored.png', type: 'image/png', base64: TINY_PNG_BASE64 }],
			{ x: 240, y: 200 }
		);

		const refWindow = page.locator(REFERENCE_WINDOW_SELECTOR);
		await expect(refWindow).toHaveCount(1);

		const before = await refWindow.boundingBox();
		if (!before) throw new Error('Reference window has no bounding box before drag');
		const titleBar = refWindow.locator('.title-bar');
		const titleBarBox = await titleBar.boundingBox();
		if (!titleBarBox) throw new Error('Title bar has no bounding box');

		const grabX = Math.round(titleBarBox.x + titleBarBox.width / 2);
		const grabY = Math.round(titleBarBox.y + titleBarBox.height / 2);
		const dropAtX = grabX + 60;
		const dropAtY = grabY + 40;

		// Drag via raw pointer events. page.mouse.move + .down + .move generate
		// mouse events which Chromium translates to pointer events, but the
		// translated pointermoves are dispatched to the element under the
		// cursor — which changes as the title bar follows the drag — and
		// setPointerCapture isn't honored for these synthetic events. Direct
		// pointer dispatch gives us a stable target.
		await page.evaluate(
			({ grabX, grabY, dropAtX, dropAtY }) => {
				const tb = document.querySelector('.overlay .window .title-bar') as HTMLElement;
				const fire = (type: string, x: number, y: number) => {
					tb.dispatchEvent(
						new PointerEvent(type, {
							pointerId: 1,
							pointerType: 'mouse',
							clientX: x,
							clientY: y,
							bubbles: true,
							cancelable: true,
							button: 0,
							buttons: type === 'pointerup' ? 0 : 1
						})
					);
				};
				fire('pointerdown', grabX, grabY);
				const steps = 10;
				for (let i = 1; i <= steps; i++) {
					const t = i / steps;
					fire('pointermove', grabX + (dropAtX - grabX) * t, grabY + (dropAtY - grabY) * t);
				}
				fire('pointerup', dropAtX, dropAtY);
			},
			{ grabX, grabY, dropAtX, dropAtY }
		);

		const expectedX = Math.round(before.x + 60);
		const expectedY = Math.round(before.y + 40);
		await expect
			.poll(async () => Math.round((await refWindow.boundingBox())?.x ?? -1))
			.toBe(expectedX);
		await expect
			.poll(async () => Math.round((await refWindow.boundingBox())?.y ?? -1))
			.toBe(expectedY);

		// Wait for the autosaved workspace record to reflect the new position
		// before reloading; otherwise the restored snapshot may be from before
		// the drag committed.
		await page.waitForFunction(
			(target) =>
				new Promise<boolean>((resolve) => {
					const req = indexedDB.open('dotorixel');
					req.onsuccess = () => {
						const db = req.result;
						const tx = db.transaction('workspace', 'readonly');
						const get = tx.objectStore('workspace').get('current');
						get.onsuccess = () => {
							const record = get.result as
								| { displayStates?: Record<string, { x: number; y: number }[]> }
								| undefined;
							db.close();
							const allStates = Object.values(record?.displayStates ?? {}).flat();
							resolve(allStates.some((s) => Math.round(s.x) === target.x && Math.round(s.y) === target.y));
						};
						get.onerror = () => {
							db.close();
							resolve(false);
						};
					};
					req.onerror = () => resolve(false);
				}),
			{ x: expectedX, y: expectedY },
			{ timeout: 10_000 }
		);
		await page.waitForTimeout(200);

		await page.reload();
		await page.getByRole('application', { name: 'Pixel art canvas' }).waitFor({ state: 'visible' });
		await waitForSessionRestored(page);

		const restored = page.locator(REFERENCE_WINDOW_SELECTOR);
		await expect(restored).toHaveCount(1);
		const restoredBox = await restored.boundingBox();
		if (!restoredBox) throw new Error('Restored window has no bounding box');
		expect(Math.round(restoredBox.x)).toBe(expectedX);
		expect(Math.round(restoredBox.y)).toBe(expectedY);
	});
});

test.describe('Reference images — tab isolation', () => {
	test('windows do not leak between tabs', async ({ editorPage }) => {
		const { page } = editorPage;

		const canvasArea = page.locator('.canvas-area').first();
		await dropFilesOnto(
			page,
			canvasArea,
			[{ name: 'tab-a.png', type: 'image/png', base64: TINY_PNG_BASE64 }],
			{ x: 240, y: 200 }
		);

		const refWindow = page.locator(REFERENCE_WINDOW_SELECTOR);
		await expect(refWindow).toHaveCount(1);

		await page.getByRole('button', { name: 'New tab' }).click();
		const tabs = page.getByRole('tab');
		await expect(tabs).toHaveCount(2);
		await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');

		await expect(refWindow).toHaveCount(0);

		await tabs.first().click();
		await expect(tabs.first()).toHaveAttribute('aria-selected', 'true');
		await expect(refWindow).toHaveCount(1);
	});
});
