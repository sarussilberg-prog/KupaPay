import { test, expect } from '@playwright/test';

test.describe('Expo web shell', () => {
    test.skip(!process.env.E2E_EXPO_WEB_URL, 'Set E2E_EXPO_WEB_URL to run against expo export / web dev server');

    test('login route loads', async ({ page }) => {
        const res = await page.goto('/', { waitUntil: 'domcontentloaded' });
        expect(res?.status()).toBeLessThan(500);
        await expect(page.locator('body')).toBeVisible();
    });
});
