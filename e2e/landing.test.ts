import { test, expect } from '@playwright/test';

test.describe('Landing page', () => {
	test('/ shows English landing page', async ({ page }) => {
		await page.goto('/');
		await expect(page.locator('h1')).toHaveText('DOTORIXEL');
		await expect(page.locator('.tagline')).toHaveText('Pixel Art Editor');
		await expect(page.locator('.cta')).toHaveText('Start Drawing');
	});

	test('/ko/ shows Korean landing page', async ({ page }) => {
		await page.goto('/ko/');
		await expect(page.locator('.tagline')).toHaveText('픽셀 아트 에디터');
		await expect(page.locator('.cta')).toHaveText('그리기 시작');
	});

	test('/ja/ shows Japanese landing page', async ({ page }) => {
		await page.goto('/ja/');
		await expect(page.locator('.tagline')).toHaveText('ピクセルアートエディター');
		await expect(page.locator('.cta')).toHaveText('描き始める');
	});
});

test.describe('Language navigation', () => {
	test('clicking Korean link from / navigates to /ko/', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('link', { name: '한국어' }).click();
		await expect(page).toHaveURL(/\/ko/);
		await expect(page.locator('.tagline')).toHaveText('픽셀 아트 에디터');
	});

	test('clicking Japanese link from / navigates to /ja/', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('link', { name: '日本語' }).click();
		await expect(page).toHaveURL(/\/ja/);
		await expect(page.locator('.tagline')).toHaveText('ピクセルアートエディター');
	});

	test('clicking English link from /ko/ navigates to /', async ({ page }) => {
		await page.goto('/ko/');
		await page.getByRole('link', { name: 'English' }).click();
		await page.waitForURL('**/');
		await expect(page.locator('.tagline')).toHaveText('Pixel Art Editor');
	});

	test('current locale is bold, not a link', async ({ page }) => {
		await page.goto('/ko/');
		const koreanLabel = page.locator('.lang-nav strong');
		await expect(koreanLabel).toHaveText('한국어');
		await expect(page.locator('.lang-nav a', { hasText: '한국어' })).toHaveCount(0);
	});
});

test.describe('CTA button', () => {
	test('CTA links to editor from /', async ({ page }) => {
		await page.goto('/');
		const cta = page.locator('.cta');
		await expect(cta).toHaveAttribute('href', /\/editor/);
	});

	test('CTA links to editor from /ko/', async ({ page }) => {
		await page.goto('/ko/');
		const cta = page.locator('.cta');
		await expect(cta).toHaveAttribute('href', /\/ko\/editor/);
	});
});
