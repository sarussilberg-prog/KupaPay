import { test, expect } from '@playwright/test';

const hasStack =
    Boolean(process.env.E2E_EXPO_WEB_URL) &&
    Boolean(process.env.E2E_TEST_PASSWORD) &&
    Boolean(process.env.E2E_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL);

async function dismissPostCreateInvite(page: import('@playwright/test').Page) {
    await page
        .getByRole('button', { name: /continue|done|skip/i })
        .first()
        .click({ timeout: 10_000 })
        .catch(() => {});
}

async function addGuestMember(page: import('@playwright/test').Page, name: string) {
    await page.getByTestId('empty-feed-add-members').click({ timeout: 15_000 });
    await page.getByTestId('add-guest-name-input').fill(name);
    await page.getByTestId('add-guest-confirm').click();
}

async function addSimpleExpense(page: import('@playwright/test').Page, description: string, amount: string) {
    await page.getByRole('button', { name: /add expense|new expense/i }).first().click({ timeout: 20_000 });
    await page.getByTestId('description-input').fill(description);
    await page.getByTestId('amount-display').click();
    await page.keyboard.type(amount);
    await page.getByTestId('add-expense-submit-bottom').click();
}

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
        await dismissPostCreateInvite(page);

        await page.getByTestId('empty-feed-add-members').click({ timeout: 15_000 }).catch(() => {});

        await addSimpleExpense(page, 'E2E lunch', '12.50');

        await page.getByTestId('group-menu-share').click({ timeout: 15_000 }).catch(async () => {
            await page.getByTestId('group-menu-share').click({ force: true });
        });

        await expect(page.getByText(/invite|link|share/i).first()).toBeVisible({ timeout: 10_000 });
    });

    test('settle-up list and record-payment sheet', async ({ page }) => {
        await page.goto('/', { waitUntil: 'domcontentloaded' });
        await expect(page.getByTestId('login-screen')).not.toBeVisible({ timeout: 30_000 });

        const groupName = `E2E settle ${Date.now()}`;
        await page.getByTestId('groups-create-btn').click({ timeout: 20_000 });
        await expect(page.getByTestId('create-group-screen')).toBeVisible({ timeout: 15_000 });
        await page.getByPlaceholder(/weekend|trip|name/i).first().fill(groupName);
        await page.getByTestId('create-group-submit').click();
        await expect(page.getByTestId('group-post-create-invite-screen')).toBeVisible({ timeout: 30_000 });
        await dismissPostCreateInvite(page);

        await addGuestMember(page, 'E2E Guest');
        await addSimpleExpense(page, 'E2E dinner', '20');

        await page.getByTestId('group-detail-settle-up').click({ timeout: 20_000 });
        await expect(page.getByTestId('settle-up-list-screen')).toBeVisible({ timeout: 20_000 });

        const debtRow = page.locator('[data-testid^="settle-debt-"]').first();
        if (await debtRow.isVisible({ timeout: 8_000 }).catch(() => false)) {
            await debtRow.click();
            await expect(page.getByTestId('settle-record-button')).toBeVisible({ timeout: 15_000 });
            await page.getByTestId('settle-record-button').click();
            await expect(page.getByTestId('settle-up-list-screen')).toBeVisible({ timeout: 20_000 });
        } else {
            await page.getByTestId('settle-record-payment-cta').click({ timeout: 15_000 });
            await expect(page.getByTestId('settle-record-button')).toBeVisible({ timeout: 15_000 });
            await page.getByTestId('settle-record-button').click();
            await expect(page.getByTestId('settle-up-list-screen')).toBeVisible({ timeout: 20_000 });
        }
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
