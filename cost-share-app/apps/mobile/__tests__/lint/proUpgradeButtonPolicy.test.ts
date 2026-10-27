import fs from 'fs';
import path from 'path';

const MOBILE_ROOT = path.join(__dirname, '../..');
const COMPONENTS_DIR = path.join(MOBILE_ROOT, 'components');

/** i18n keys that must only appear on ProUpgradeButton (not raw TouchableOpacity/Pressable CTAs). */
const PRO_UPGRADE_TITLE_MARKERS = [
    'pro.tripCurrency.upgrade',
    'pro.tripBudget.upgrade',
    'pro.spendingInsights.upgrade',
    'monetization.proPromo.cta',
    'monetization.goProButton',
] as const;

const ALLOWLIST = new Set([
    path.join(COMPONENTS_DIR, 'ProUpgradeButton.tsx'),
    path.join(COMPONENTS_DIR, 'pro/ProUpsellButton.tsx'),
    path.join(COMPONENTS_DIR, 'Button.tsx'),
]);

function walkTsx(dir: string, out: string[] = []): string[] {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
            walkTsx(full, out);
        } else if (entry.name.endsWith('.tsx')) {
            out.push(full);
        }
    }
    return out;
}

function isRawPrimaryCtaWithUpgradeMarker(content: string, marker: string): boolean {
    if (!content.includes(marker)) return false;
    if (content.includes('ProUpgradeButton') || content.includes('ProUpsellButton')) return false;
    const hasRawTouchable =
        /TouchableOpacity[\s\S]{0,400}/.test(content) || /Pressable[\s\S]{0,400}/.test(content);
    const hasPrimaryShell = /bg-primary rounded/.test(content);
    return hasRawTouchable && hasPrimaryShell && content.includes(marker);
}

describe('Pro upgrade CTA policy', () => {
    it('requires ProUpgradeButton for Pro upsell title keys', () => {
        const files = walkTsx(COMPONENTS_DIR).filter(f => !ALLOWLIST.has(f));
        const violations: string[] = [];

        for (const file of files) {
            const content = fs.readFileSync(file, 'utf8');
            for (const marker of PRO_UPGRADE_TITLE_MARKERS) {
                if (isRawPrimaryCtaWithUpgradeMarker(content, marker)) {
                    violations.push(`${path.relative(MOBILE_ROOT, file)} uses ${marker} outside ProUpgradeButton`);
                }
            }
        }

        expect(violations).toEqual([]);
    });
});
