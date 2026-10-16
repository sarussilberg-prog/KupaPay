import fs from 'fs';
import path from 'path';
import i18n from 'i18next';
import {
    collectStaticI18nKeysFromSource,
    GROUP_TYPES,
} from '@cost-share/shared';
import {
    mobileI18nResources,
    MOBILE_I18N_LOCALE_CODES,
} from '../../i18n/localeConfig';

const MOBILE_APP_ROOT = path.join(__dirname, '../..');
const SCAN_DIRS = ['components', 'screens', 'lib', 'hooks', 'dev'] as const;

/** Substitute common {{…}} placeholders so plural and interpolation keys resolve. */
const DEFAULT_T_OPTS: Record<string, unknown> = {
    count: 2,
    when: 'T',
    amount: '₪1',
    names: 'Noa',
    name: 'Noa',
    email: 'x@y.z',
    seconds: 30,
    plus: '+1',
    currency: 'ILS',
    groupName: 'Test',
    defaultValue: '',
};

function collectDynamicI18nKeys(): string[] {
    const keys: string[] = [];
    for (const type of GROUP_TYPES) {
        keys.push(`groups.types.${type}`);
    }
    return keys;
}

function listSourceFiles(): string[] {
    const files: string[] = [];
    const walk = (dir: string) => {
        if (!fs.existsSync(dir)) return;
        for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
            if (ent.name === 'node_modules' || ent.name === '__tests__') continue;
            const full = path.join(dir, ent.name);
            if (ent.isDirectory()) walk(full);
            else if (/\.(tsx?|jsx?)$/.test(ent.name)) files.push(full);
        }
    };
    for (const sub of SCAN_DIRS) {
        walk(path.join(MOBILE_APP_ROOT, sub));
    }
    return files;
}

function collectUsedI18nKeys(): string[] {
    const keys = new Set<string>(collectDynamicI18nKeys());
    for (const file of listSourceFiles()) {
        const source = fs.readFileSync(file, 'utf8');
        for (const key of collectStaticI18nKeysFromSource(source)) {
            keys.add(key);
        }
    }
    return [...keys].sort((a, b) => a.localeCompare(b));
}

function isResolved(key: string, locale: string): boolean {
    void i18n.changeLanguage(locale);
    const out = i18n.t(key, DEFAULT_T_OPTS);
    return out !== key && !out.startsWith(`${key}_`);
}

describe('mobile used i18n keys exist in every locale', () => {
    const usedKeys = collectUsedI18nKeys();

    beforeAll(async () => {
        await i18n.init({
            resources: mobileI18nResources,
            lng: 'en',
            fallbackLng: 'en',
            interpolation: { escapeValue: false },
        });
    });

    it('includes groups.card.updatedAgo (GroupCard meta regression)', () => {
        expect(usedKeys).toContain('groups.card.updatedAgo');
    });

    it.each(MOBILE_I18N_LOCALE_CODES)('%s resolves every key used in mobile UI code', locale => {
        const missing = usedKeys.filter(key => !isResolved(key, locale));
        expect(missing).toEqual([]);
    });
});
