import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve } from 'path';

const MOBILE_DIR = resolve(__dirname, '../..');

const SKIP_DIRS = new Set(['node_modules', '__tests__', 'assets', '.expo']);

const ALLOWLIST = new Set([
    resolve(MOBILE_DIR, 'components/AppIcon.tsx'),
    resolve(MOBILE_DIR, 'components/ui/IconLabel.tsx'),
    resolve(MOBILE_DIR, 'components/ui/ListRow.tsx'),
    resolve(MOBILE_DIR, 'components/ui/MenuRow.tsx'),
    resolve(MOBILE_DIR, 'components/ui/iconLabelLayout.ts'),
    resolve(MOBILE_DIR, 'components/expenseV2/QuietIconPill.tsx'),
    resolve(MOBILE_DIR, 'components/EmptyState.tsx'),
    resolve(MOBILE_DIR, 'components/FeedRowCard.tsx'),
    resolve(MOBILE_DIR, 'components/FeedRowThumbnail.tsx'),
    resolve(MOBILE_DIR, 'components/FeedItemDetailSheet.tsx'),
    resolve(MOBILE_DIR, 'components/onboarding/OnboardingAppMockup.tsx'),
]);

/** Ad-hoc margin on Text immediately after AppIcon — use IconLabel/ListRow instead. */
const AD_HOC_ICON_TEXT_MARGIN =
    /<AppIcon[\s\S]{0,160}?>\s*\n\s*<Text className="[^"]*\b(?:ml|mr|ms|me)-(?:1\.5|2|2\.5|3)\b/;

function walk(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
        if (SKIP_DIRS.has(entry)) continue;
        const full = resolve(dir, entry);
        if (statSync(full).isDirectory()) walk(full, out);
        else if (full.endsWith('.tsx') && !ALLOWLIST.has(full)) out.push(full);
    }
    return out;
}

describe('IconLabel guard — no ad-hoc icon+text margins', () => {
    it('settings and menu surfaces use shared IconLabel primitives', () => {
        const offenders = walk(MOBILE_DIR).filter((file) => {
            const src = readFileSync(file, 'utf8');
            if (!src.includes('<AppIcon')) return false;
            if (src.includes('IconLabel') || src.includes('MenuRow') || src.includes('SettingsRow')) {
                return AD_HOC_ICON_TEXT_MARGIN.test(src);
            }
            return false;
        });
        expect(offenders).toEqual([]);
    });

    it('settings rows do not import AppIcon for leading labels', () => {
        const settingsDir = resolve(MOBILE_DIR, 'components/settings');
        const SETTINGS_ICON_ALLOW = new Set(['LanguageSheet.tsx', 'LegalDocumentSheet.tsx']);
        const bad = readdirSync(settingsDir)
            .filter((f) => f.endsWith('.tsx') && f !== 'SettingsRow.tsx' && !SETTINGS_ICON_ALLOW.has(f))
            .map((f) => resolve(settingsDir, f))
            .filter((file) => {
                const src = readFileSync(file, 'utf8');
                return src.includes('<AppIcon') && !src.includes('IconLabel') && !src.includes('MenuRow');
            });
        expect(bad).toEqual([]);
    });
});
