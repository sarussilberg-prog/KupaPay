import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

export async function expectLoggedIn(page: Page) {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('login-screen')).not.toBeVisible({ timeout: 30_000 });
}

export async function dismissPostCreateInvite(page: Page) {
    await page
        .getByRole('button', { name: /continue|done|skip/i })
        .first()
        .click({ timeout: 10_000 })
        .catch(() => {});
}

export async function createGroup(page: Page, groupName: string) {
    await page.getByTestId('groups-create-btn').click({ timeout: 20_000 });
    await expect(page.getByTestId('create-group-screen')).toBeVisible({ timeout: 15_000 });
    await page.getByPlaceholder(/weekend|trip|name/i).first().fill(groupName);
    await page.getByTestId('create-group-submit').click();
    await expect(page.getByTestId('group-post-create-invite-screen')).toBeVisible({ timeout: 30_000 });
    await dismissPostCreateInvite(page);
}

export async function addGuestMember(page: Page, name: string) {
    await page.getByTestId('empty-feed-add-members').click({ timeout: 15_000 });
    await page.getByTestId('add-guest-name-input').fill(name);
    await page.getByTestId('add-guest-confirm').click();
}

export async function addSimpleExpense(page: Page, description: string, amount: string) {
    await page.getByRole('button', { name: /add expense|new expense/i }).first().click({ timeout: 20_000 });
    await page.getByTestId('description-input').fill(description);
    await page.getByTestId('amount-display').click();
    await page.keyboard.type(amount);
    await page.getByTestId('add-expense-submit-bottom').click();
}
