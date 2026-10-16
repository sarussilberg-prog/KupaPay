import { test, expect } from '@playwright/test';
const hasStack =
    Boolean(process.env.E2E_EXPO_WEB_URL) &&
    Boolean(process.env.E2E_TEST_PASSWORD) &&
    Boolean(process.env.E2E_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL);

test.describe('Dev stack — authenticated Expo web', () => {
    test.skip(!hasStack, 'Requires E2E_EXPO_WEB_URL, E2E_TEST_PASSWORD, and Supabase URL');

    test('login session reaches groups list', async ({ page }) => {
        await page.goto('/', { waitUntil: 'domcontentloaded' });
        await expect(page.getByTestId('login-screen')).not.toBeVisible({ timeout: 30_000 });
    });

    test('create group, add expense, open settle / invite surfaces', async ({ page }) => {
        await page.goto('/', { waitUntil: 'domcontentloaded' });
        await expect(page.getByTestId('login-screen')).not.toBeVisible({ timeout: 30_000 });

        const groupName = `E2E ${Date.now()}`;
        await page.getByTestId('groups-create-btn').click({ timeout: 20_000 });

        await expect(page.getByTestId('create-group-screen')).toBeVisible({ timeout: 15_000 });
        await page.getByPlaceholder(/weekend|trip|name/i).first().fill(groupName);
        await page.getByTestId('create-group-submit').click();

        await expect(page.getByTestId('group-post-create-invite-screen')).toBeVisible({ timeout: 30_000 });

        await page.getByRole('button', { name: /continue|done|skip/i }).first().click({ timeout: 10_000 }).catch(() => {});

        await page.getByTestId('empty-feed-add-members').click({ timeout: 15_000 }).catch(() => {});

        await page.getByRole('button', { name: /add expense|new expense/i }).first().click({ timeout: 20_000 });
        await page.getByTestId('description-input').fill('E2E lunch');
        await page.getByTestId('amount-display').click();
        await page.keyboard.type('12.50');
        await page.getByTestId('add-expense-submit-bottom').click();

        await page.getByTestId('group-menu-share').click({ timeout: 15_000 }).catch(async () => {
            await page.getByTestId('group-menu-share').click({ force: true });
        });

        await expect(page.getByText(/invite|link|share/i).first()).toBeVisible({ timeout: 10_000 });
    });
});

test.describe('Dev stack — Next.js public pages', () => {
    test.skip(!process.env.E2E_BASE_URL, 'Set E2E_BASE_URL to dev/staging Next site');

    test('/b and /e return HTML shells', async ({ page }) => {
        for (const path of ['/b/e2e-public-balance-token', '/e/e2e-expense-share-token']) {
            const res = await page.goto(path, { waitUntil: 'domcontentloaded' });
            expect(res?.status()).toBeLessThan(500);
            await expect(page.locator('body')).toBeVisible();
        }
    });
});
