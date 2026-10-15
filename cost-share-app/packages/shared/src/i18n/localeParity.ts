/**
 * Flatten nested i18n JSON and compare keys / interpolation placeholders across locales.
 */

export type FlatLocale = Record<string, string>;

export function flattenLocale(obj: unknown, prefix = ''): FlatLocale {
    if (obj === null || obj === undefined) {
        return {};
    }
    if (typeof obj === 'string') {
        return prefix ? { [prefix]: obj } : {};
    }
    if (Array.isArray(obj)) {
        const out: FlatLocale = {};
        obj.forEach((item, index) => {
            Object.assign(out, flattenLocale(item, prefix ? `${prefix}.${index}` : String(index)));
        });
        return out;
    }
    if (typeof obj === 'object') {
        const out: FlatLocale = {};
        for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
            const next = prefix ? `${prefix}.${key}` : key;
            Object.assign(out, flattenLocale(value, next));
        }
        return out;
    }
    return {};
}

const PLACEHOLDER_RE = /\{\{[^{}]+\}\}/g;

export function extractPlaceholders(value: string): string[] {
    const matches = value.match(PLACEHOLDER_RE);
    if (!matches) return [];
    return [...matches].sort((a, b) => a.localeCompare(b));
}

const PLURAL_SUFFIX_RE = /_(zero|one|two|few|many|other)$/;

/**
 * Plural variants may differ in whether they spell out {{count}}: English `_one` often hardcodes "1",
 * while languages like Russian must keep {{count}} because their "one" form also covers 21, 31, ...
 */
function placeholdersForParity(key: string, value: string): string[] {
    const placeholders = extractPlaceholders(value);
    return PLURAL_SUFFIX_RE.test(key) ? placeholders.filter((p) => p !== '{{count}}') : placeholders;
}

export type LocaleParityIssue =
    | { kind: 'missing_key'; locale: string; key: string }
    | { kind: 'extra_key'; locale: string; key: string }
    | { kind: 'placeholder_mismatch'; locale: string; key: string; base: string[]; other: string[] };

export function compareLocaleToBase(
    baseLocale: FlatLocale,
    otherLocale: FlatLocale,
    localeCode: string,
    options?: { allowExtraKeys?: boolean },
): LocaleParityIssue[] {
    const issues: LocaleParityIssue[] = [];
    const allowExtra = options?.allowExtraKeys ?? false;

    for (const key of Object.keys(baseLocale)) {
        if (!(key in otherLocale)) {
            issues.push({ kind: 'missing_key', locale: localeCode, key });
            continue;
        }
        const basePh = placeholdersForParity(key, baseLocale[key] ?? '');
        const otherPh = placeholdersForParity(key, otherLocale[key] ?? '');
        if (basePh.join('|') !== otherPh.join('|')) {
            issues.push({
                kind: 'placeholder_mismatch',
                locale: localeCode,
                key,
                base: basePh,
                other: otherPh,
            });
        }
    }

    if (!allowExtra) {
        for (const key of Object.keys(otherLocale)) {
            if (!(key in baseLocale)) {
                issues.push({ kind: 'extra_key', locale: localeCode, key });
            }
        }
    }

    return issues;
}

export type UntranslatedIssue = { kind: 'untranslated'; locale: string; key: string; value: string };

export function findUntranslatedFromBase(
    baseLocale: FlatLocale,
    otherLocale: FlatLocale,
    localeCode: string,
    isAllowed: (value: string) => boolean,
): UntranslatedIssue[] {
    const issues: UntranslatedIssue[] = [];
    for (const key of Object.keys(baseLocale)) {
        const baseVal = baseLocale[key];
        const otherVal = otherLocale[key];
        if (otherVal === undefined) continue;
        if (otherVal === baseVal && !isAllowed(baseVal)) {
            issues.push({ kind: 'untranslated', locale: localeCode, key, value: baseVal });
        }
    }
    return issues;
}
