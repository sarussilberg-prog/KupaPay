import { test, expect } from '@playwright/test';

test.describe('Next.js public link pages', () => {
    test.skip(!process.env.E2E_BASE_URL, 'Set E2E_BASE_URL to run against a live Next dev/preview server');

    test('/b/:token returns HTML (balance page shell)', async ({ page }) => {
        const res = await page.goto('/b/e2e-smoke-balance-token', { waitUntil: 'domcontentloaded' });
        expect(res?.status()).toBeLessThan(500);
        await expect(page.locator('body')).toBeVisible();
    });

    test('/e/:token returns HTML (expense share shell)', async ({ page }) => {
        const res = await page.goto('/e/e2e-smoke-expense-token', { waitUntil: 'domcontentloaded' });
        expect(res?.status()).toBeLessThan(500);
        await expect(page.locator('body')).toBeVisible();
    });
});
