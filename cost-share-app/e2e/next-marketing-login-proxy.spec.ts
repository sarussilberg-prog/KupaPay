import { test, expect } from '@playwright/test';

const LOGIN_VISIBLE_MS = 15_000;

test.describe('Marketing site → proxied login', () => {
    test.skip(!process.env.E2E_BASE_URL, 'Set E2E_BASE_URL to run against deployed or preview marketing site');

    test('landing login link loads Expo shell and static bundles', async ({ page, baseURL }) => {
        const expoAssetFailures: string[] = [];
        const consoleErrors: string[] = [];

        page.on('requestfailed', (request) => {
            const url = request.url();
            if (url.includes('/_expo/')) {
                expoAssetFailures.push(`${request.failure()?.errorText ?? 'failed'} ${url}`);
            }
        });

        page.on('response', (response) => {
            const url = response.url();
            if (!url.includes('/_expo/')) {
                return;
            }
            const status = response.status();
            const contentType = (response.headers()['content-type'] ?? '').toLowerCase();
            if (status >= 400) {
                expoAssetFailures.push(`HTTP ${status} ${url}`);
            }
            if (url.endsWith('.js') && !contentType.includes('javascript') && !contentType.includes('json')) {
                expoAssetFailures.push(`wrong MIME for JS ${contentType} ${url}`);
            }
            if (url.endsWith('.css') && !contentType.includes('css')) {
                expoAssetFailures.push(`wrong MIME for CSS ${contentType} ${url}`);
            }
        });

        page.on('console', (msg) => {
            if (msg.type() === 'error') {
                consoleErrors.push(msg.text());
            }
        });

        const landing = await page.goto('/en', { waitUntil: 'domcontentloaded' });
        expect(landing?.status()).toBeLessThan(400);

        const loginLink = page.locator('a[href="/login"]').first();
        await expect(loginLink).toBeVisible({ timeout: LOGIN_VISIBLE_MS });
        await loginLink.click();

        await expect(page).toHaveURL(/\/login/, { timeout: LOGIN_VISIBLE_MS });
        await expect(page.locator('[data-testid="login-screen"]')).toBeVisible({
            timeout: LOGIN_VISIBLE_MS,
        });

        expect(expoAssetFailures, `/_expo/ asset failures on ${baseURL}`).toEqual([]);
        expect(consoleErrors, `console errors on ${baseURL}`).toEqual([]);
    });
});
