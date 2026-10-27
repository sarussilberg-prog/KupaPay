import { readFileSync } from 'fs';
import { join } from 'path';

const PURCHASES_SERVICE = join(__dirname, '../../services/purchases.service.ts');
const MY_SUBSCRIPTION = join(__dirname, '../../services/mySubscription.service.ts');

describe('RevenueCat configure gate (issue #535)', () => {
    it('waits for Purchases configure before intro eligibility checks', () => {
        const src = readFileSync(PURCHASES_SERVICE, 'utf8');
        const fn = src.slice(
            src.indexOf('export async function checkIntroductoryPriceEligibility'),
            src.indexOf('export async function fetchProSubscriptionUiState'),
        );
        expect(fn).toMatch(/waitForPurchasesReady\(\)/);
    });

    it('auto-starts configure in waitForPurchasesReady when a signed-in user exists', () => {
        const src = readFileSync(PURCHASES_SERVICE, 'utf8');
        const fn = src.slice(
            src.indexOf('export async function waitForPurchasesReady'),
            src.indexOf('export async function fetchPurchasesCustomerInfo'),
        );
        expect(fn).toMatch(/configurePurchasesForUser/);
    });

    it('routes subscription snapshot CustomerInfo through fetchPurchasesCustomerInfo', () => {
        const sub = readFileSync(MY_SUBSCRIPTION, 'utf8');
        expect(sub).toContain('fetchPurchasesCustomerInfo');
        expect(sub).not.toMatch(/import\s*\(\s*['"]react-native-purchases['"]\s*\)/);
    });
});
