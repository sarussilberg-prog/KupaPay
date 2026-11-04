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
    | 'pro-paywall';

const ASC_SCREEN_READY: Record<AscScreen, string> = {
    groups: '[data-testid="groups-list-virtualized"]',
    balances: '[data-testid="balances-screen-root"]',
    'add-expense': '[data-testid="amount-display"]',
    'simplified-debts': '[data-testid="settle-up-list-screen"]',
    'pro-paywall': '[data-testid="paywall-purchase-btn"], [data-testid="paywall-loading"]',
};

const SCREEN_FILE_SLUG: Record<AscScreen, string> = {
    groups: 'groups-list',
    balances: 'group-detail-balances',
    'add-expense': 'add-expense',
    'simplified-debts': 'settle-up',
    'pro-paywall': 'paywall',
};

async function openAscCapture(
    page: import('@playwright/test').Page,
    screen: AscScreen,
    locale: LocaleTag,
) {
    const url = `${baseURL}/?capture=1&screen=${screen}&locale=${locale}&phone=1`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await expect(page.getByTestId('asc-capture-ready')).toBeVisible({ timeout: 120_000 });
    await expect(page.locator(ASC_SCREEN_READY[screen]).first()).toBeVisible({ timeout: 60_000 });
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

        const summaryCard = page.getByTestId('groups-list-summary-card');
        await expect(summaryCard).toBeVisible();
        const summaryLabel = page.getByTestId('groups-list-summary-label');
        const summaryAmount = page.getByTestId('groups-list-summary-amount');
        const cardBox = await summaryCard.boundingBox();
        const labelBox = await summaryLabel.boundingBox();
        const amountBox = await summaryAmount.boundingBox();
        expect(cardBox).toBeTruthy();
        expect(labelBox).toBeTruthy();
        expect(amountBox).toBeTruthy();

        const cardInnerRight = cardBox!.x + cardBox!.width - 16;
        const cardInnerLeft = cardBox!.x + 16;
        const edgeTolerancePx = 12;

        if (expectRtl) {
            expect(Math.abs(labelBox!.x + labelBox!.width - cardInnerRight)).toBeLessThanOrEqual(
                edgeTolerancePx,
            );
            expect(Math.abs(amountBox!.x + amountBox!.width - cardInnerRight)).toBeLessThanOrEqual(
                edgeTolerancePx,
            );
        } else {
            expect(Math.abs(labelBox!.x - cardInnerLeft)).toBeLessThanOrEqual(edgeTolerancePx);
            expect(Math.abs(amountBox!.x - cardInnerLeft)).toBeLessThanOrEqual(edgeTolerancePx);
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
