/**
 * Extract static i18n keys from source (t('foo.bar') / t("foo.bar")).
 */

const STATIC_T_KEY_RE =
    /\bt\(\s*['"]([a-zA-Z0-9][a-zA-Z0-9_.]*(?:\.[a-zA-Z0-9_]+)*)['"]/g;

export function collectStaticI18nKeysFromSource(source: string): string[] {
    const keys = new Set<string>();
    for (const match of source.matchAll(STATIC_T_KEY_RE)) {
        keys.add(match[1]);
    }
    return [...keys].sort((a, b) => a.localeCompare(b));
}
