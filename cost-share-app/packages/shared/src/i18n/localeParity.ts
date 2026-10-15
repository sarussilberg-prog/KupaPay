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

const PLACEHOLDER_RE = /\{\{[^}]+\}\}/g;

export function extractPlaceholders(value: string): string[] {
    const matches = value.match(PLACEHOLDER_RE);
    if (!matches) return [];
    return [...matches].sort();
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
        const basePh = extractPlaceholders(baseLocale[key] ?? '');
        const otherPh = extractPlaceholders(otherLocale[key] ?? '');
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
