import { test, expect } from '@playwright/test';

// Pin the default browser locale for tests below so that existing assertions
// remain stable regardless of the host OS language. Tests that exercise
// browser-preference behavior create their own context explicitly.
test.use({ locale: 'en-US' });

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

test.describe('GitHub link', () => {
	test('nav GitHub link points to repo and opens in new tab', async ({ page }) => {
		await page.goto('/');
		const gh = page.getByRole('link', { name: 'GitHub repository' });
		await expect(gh).toHaveAttribute('href', 'https://github.com/siluat/dotorixel');
		await expect(gh).toHaveAttribute('target', '_blank');
		await expect(gh).toHaveAttribute('rel', 'noopener noreferrer');
	});
});

test.describe('Features section', () => {
	test('renders section title and three feature cards', async ({ page }) => {
		await page.goto('/');
		await expect(page.getByRole('heading', { name: 'Features', level: 2 })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Browser-Based', level: 3 })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Drawing Tools', level: 3 })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Auto-Save', level: 3 })).toBeVisible();
	});
});

test.describe('Roadmap section', () => {
	test('renders section title and three roadmap cards', async ({ page }) => {
		await page.goto('/');
		await expect(page.getByRole('heading', { name: 'Roadmap', level: 2 })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Layers & Animation', level: 3 })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Integrations', level: 3 })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Offline App', level: 3 })).toBeVisible();
	});
});

test.describe('Editor mockup', () => {
	test('renders editor preview image', async ({ page }) => {
		await page.goto('/');
		const mockup = page.locator('.editor-mockup');
		await expect(mockup).toBeVisible();
		await expect(mockup).toHaveAttribute('alt', /DOTORIXEL/i);
		await expect
			.poll(async () =>
				mockup.evaluate((img) => {
					const image = img as HTMLImageElement;
					return image.complete && image.naturalWidth > 0;
				}),
			)
			.toBe(true);
	});
});

test.describe('Localized sections', () => {
	test('/ko/ renders Features and Roadmap titles in Korean', async ({ page }) => {
		await page.goto('/ko/');
		await expect(page.getByRole('heading', { name: '기능', level: 2 })).toBeVisible();
		await expect(page.getByRole('heading', { name: '로드맵', level: 2 })).toBeVisible();
	});

	test('/ja/ renders Features and Roadmap titles in Japanese', async ({ page }) => {
		await page.goto('/ja/');
		await expect(page.getByRole('heading', { name: '機能', level: 2 })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'ロードマップ', level: 2 })).toBeVisible();
	});
});

test.describe('Auto locale detection on root', () => {
	test('Korean browser preference renders / in Korean', async ({ browser }) => {
		const context = await browser.newContext({ locale: 'ko-KR' });
		const page = await context.newPage();
		await page.goto('/');
		await expect(page.locator('.tagline')).toHaveText('픽셀 아트 에디터');
		await context.close();
	});

	test('Japanese browser preference renders / in Japanese', async ({ browser }) => {
		const context = await browser.newContext({ locale: 'ja-JP' });
		const page = await context.newPage();
		await page.goto('/');
		await expect(page.locator('.tagline')).toHaveText('ピクセルアートエディター');
		await context.close();
	});

	test('explicit /ja/ URL wins over Korean browser preference', async ({ browser }) => {
		const context = await browser.newContext({ locale: 'ko-KR' });
		const page = await context.newPage();
		await page.goto('/ja/');
		await expect(page.locator('.tagline')).toHaveText('ピクセルアートエディター');
		await context.close();
	});
});

test.describe('Explicit locale choice persists', () => {
	test('clicking English from / persists en; subsequent visits stay English despite Korean preference', async ({ browser }) => {
		const context = await browser.newContext({ locale: 'ko-KR' });
		const page = await context.newPage();

		// First visit: auto-detected Korean.
		await page.goto('/');
		await expect(page.locator('.tagline')).toHaveText('픽셀 아트 에디터');

		// User explicitly picks English.
		await page.getByRole('link', { name: 'English' }).click();
		await page.waitForURL('**/');
		await expect(page.locator('.tagline')).toHaveText('Pixel Art Editor');

		// localStorage records the choice under Paraglide's key.
		const stored = await page.evaluate(() => localStorage.getItem('PARAGLIDE_LOCALE'));
		expect(stored).toBe('en');

		// Re-visit root: localStorage wins over preferredLanguage.
		await page.goto('/');
		await expect(page.locator('.tagline')).toHaveText('Pixel Art Editor');

		await context.close();
	});
});

test.describe('Locale persistence guard (non-primary clicks)', () => {
	// Regression defense: when a user middle-clicks or modifier-clicks the
	// language selector, the browser opens the link in a new tab/window — a
	// preview gesture, not a locale commitment. `onclick` still fires, so the
	// handler must skip persistence; otherwise the next `/` visit auto-detects
	// the previewed locale even though the user never switched.
	//
	// Paraglide's localStorage strategy writes the resolved locale during
	// hydration (so localStorage often contains `'en'` after load), which is
	// unrelated to our click guard. The assertion therefore targets the exact
	// regression: the Korean-link click must not persist `'ko'`.
	// A synthetic primary-button click on an anchor still triggers the browser's
	// default navigation, which races the follow-up `page.evaluate` — on slower
	// CI runners the context is destroyed before the read lands. Dispatching the
	// event and reading `localStorage` inside a single `evaluate` keeps both
	// steps in one synchronous browser turn, before any navigation task runs.
	test('middle-click on 한국어 does not persist ko', async ({ page }) => {
		await page.goto('/');
		const stored = await page
			.getByRole('link', { name: '한국어' })
			.evaluate((el) => {
				el.dispatchEvent(
					new MouseEvent('click', { button: 1, bubbles: true, cancelable: true }),
				);
				return localStorage.getItem('PARAGLIDE_LOCALE');
			});
		expect(stored).not.toBe('ko');
	});

	test('modifier-key click on 한국어 does not persist ko', async ({ page }) => {
		await page.goto('/');
		const stored = await page
			.getByRole('link', { name: '한국어' })
			.evaluate((el) => {
				el.dispatchEvent(
					new MouseEvent('click', {
						button: 0,
						metaKey: true,
						bubbles: true,
						cancelable: true,
					}),
				);
				return localStorage.getItem('PARAGLIDE_LOCALE');
			});
		expect(stored).not.toBe('ko');
	});
});
