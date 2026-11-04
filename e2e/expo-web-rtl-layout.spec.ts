import { test, expect } from '@playwright/test';

const baseURL = process.env.E2E_EXPO_WEB_URL ?? 'http://127.0.0.1:8081';

/**
 * Real DOM layout checks for Group list B2 preview (not style fixtures).
 * Uses ?devGroupsListB2Preview=1&lang=… which calls initializeLanguageForCapture.
 */
test.describe('Expo web — RTL group card physical order', () => {
    test.skip(!process.env.E2E_EXPO_WEB_URL && !process.env.CI, 'Set E2E_EXPO_WEB_URL for local runs');

    async function assertGroupCardMirror(page: import('@playwright/test').Page, expectRtl: boolean) {
        await page.goto(
            `${baseURL}/?devGroupsListB2Preview=1&lang=${expectRtl ? 'he' : 'en'}&theme=light&narrow=1&stress=1&width=390`,
            { waitUntil: 'networkidle', timeout: 120_000 },
        );
        await expect(page.getByTestId('groups-list-title')).toBeVisible({ timeout: 60_000 });

        const row = page.getByTestId('group-card-probe-row-inner').first();
        await expect(row).toBeVisible({ timeout: 30_000 });

        const avatar = page.getByTestId('group-card-probe-avatar').first();
        const name = page.getByTestId('group-card-probe-name').first();
        const menu = page.getByTestId('group-card-probe-menu').first();

        const avatarBox = await avatar.boundingBox();
        const nameBox = await name.boundingBox();
        const menuBox = await menu.boundingBox();
        expect(avatarBox).toBeTruthy();
        expect(nameBox).toBeTruthy();
        expect(menuBox).toBeTruthy();

        if (expectRtl) {
            expect(avatarBox!.x).toBeGreaterThan(nameBox!.x);
            expect(menuBox!.x).toBeLessThan(nameBox!.x);
        } else {
            expect(avatarBox!.x).toBeLessThan(nameBox!.x);
            expect(menuBox!.x).toBeGreaterThan(nameBox!.x);
        }
    }

    test('English LTR — avatar left, menu right', async ({ page }) => {
        await assertGroupCardMirror(page, false);
    });

    test('Hebrew RTL — avatar right, menu left', async ({ page }) => {
        await assertGroupCardMirror(page, true);
    });
});
