import path from 'node:path';
import { test, expect } from '@playwright/test';

const SCREENSHOT_DIR = path.resolve(__dirname, '../../docs/rtl-screenshots/web');

const baseURL = process.env.E2E_EXPO_WEB_URL ?? 'http://127.0.0.1:8081';

type LocaleTag = 'en-US' | 'he-IL';
type AscScreen =
    | 'groups'
    | 'balances'
    | 'add-expense'
    | 'simplified-debts'
    | 'pro-paywall'
    | 'settings-pro';

const ASC_SCREEN_READY: Record<AscScreen, string> = {
    groups: '[data-testid="asc-demo-screen-groups"]',
    balances: '[data-testid="asc-demo-screen-balances"]',
    'add-expense': '[data-testid="asc-demo-screen-add-expense"]',
    'simplified-debts': '[data-testid="asc-demo-screen-simplified-debts"]',
    'pro-paywall': '[data-testid="asc-demo-screen-pro-paywall"]',
    'settings-pro': '[data-testid="asc-demo-screen-settings-pro"]',
};

const SCREEN_FILE_SLUG: Record<AscScreen, string> = {
    groups: 'groups-list',
    balances: 'group-detail-balances',
    'add-expense': 'add-expense',
    'simplified-debts': 'settle-up',
    'pro-paywall': 'paywall',
    'settings-pro': 'settings',
};

async function openAscCapture(
    page: import('@playwright/test').Page,
    screen: AscScreen,
    locale: LocaleTag,
) {
    const url = `${baseURL}/?capture=1&screen=${screen}&locale=${locale}&phone=1`;
    await page.goto(url, { waitUntil: 'networkidle', timeout: 120_000 });
    await expect(page.locator(ASC_SCREEN_READY[screen])).toBeVisible({ timeout: 90_000 });
    const lang = locale.startsWith('he') ? 'he' : 'en';
    await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `${SCREEN_FILE_SLUG[screen]}-${lang}.png`),
        fullPage: true,
    });
}

test.describe('Expo web — RTL group card physical order (B2 preview)', () => {
    test.skip(!process.env.E2E_EXPO_WEB_URL && !process.env.CI, 'Set E2E_EXPO_WEB_URL for local runs');

    async function assertGroupCardMirror(page: import('@playwright/test').Page, expectRtl: boolean) {
        await page.goto(
            `${baseURL}/?devGroupsListB2Preview=1&lang=${expectRtl ? 'he' : 'en'}&theme=light&narrow=1&stress=1&width=390`,
            { waitUntil: 'networkidle', timeout: 120_000 },
        );
        await expect(page.getByTestId('groups-list-title')).toBeVisible({ timeout: 60_000 });

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

        await page.screenshot({
            path: path.join(SCREENSHOT_DIR, `groups-list-probe-${expectRtl ? 'he' : 'en'}.png`),
            fullPage: true,
        });
    }

    test('English LTR — avatar left, menu right', async ({ page }) => {
        await assertGroupCardMirror(page, false);
    });

    test('Hebrew RTL — avatar right, menu left', async ({ page }) => {
        await assertGroupCardMirror(page, true);
    });
});

test.describe('Expo web — ASC capture RTL screenshots', () => {
    test.skip(!process.env.E2E_EXPO_WEB_URL && !process.env.CI, 'Set E2E_EXPO_WEB_URL for local runs');

    for (const locale of ['en-US', 'he-IL'] as const) {
        for (const screen of Object.keys(ASC_SCREEN_READY) as AscScreen[]) {
            test(`${screen} @ ${locale}`, async ({ page }) => {
                await openAscCapture(page, screen, locale);
                const dir = await page.locator('html').getAttribute('dir');
                if (locale.startsWith('he')) {
                    expect(dir).toBe('rtl');
                } else {
                    expect(dir).toBe('ltr');
                }
            });
        }
    }
});
