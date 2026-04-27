import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: 'e2e',
	timeout: 30_000,
	expect: { timeout: 10_000 },
	retries: process.env.CI ? 2 : 0,
	webServer: {
		command: 'bun run dev',
		port: 5173,
		reuseExistingServer: !process.env.CI,
	},
	use: {
		baseURL: 'http://localhost:5173',
		viewport: { width: 1280, height: 720 },
	},
	projects: [
		{ name: 'chromium', use: { ...devices['Desktop Chrome'] } },
	],
});
