import { SUPPORTED_LANGUAGES, type Language } from '../i18n/languages';
import type { LegalSlug } from '../types';
import {
    LEGAL_EU_ADDRESS_TOKEN_HE,
    LEGAL_PLACEHOLDER_TOKENS,
    countLegalPlaceholders,
    countLegalSections,
} from './legalPlaceholders';

export type LegalParityIssue =
    | { kind: 'missing_file'; slug: LegalSlug; locale: Language }
    | { kind: 'section_count_mismatch'; slug: LegalSlug; locale: Language; base: number; other: number }
    | { kind: 'placeholder_mismatch'; slug: LegalSlug; locale: Language; token: string; base: number; other: number }
    | { kind: 'missing_eu_trader_address'; slug: LegalSlug; locale: Language };

function countToken(markdown: string, token: string): number {
    let count = 0;
    let idx = 0;
    while ((idx = markdown.indexOf(token, idx)) !== -1) {
        count += 1;
        idx += token.length;
    }
    return count;
}

export function compareLegalMarkdownToBase(
    slug: LegalSlug,
    baseMarkdown: string,
    locale: Language,
    otherMarkdown: string,
): LegalParityIssue[] {
    const issues: LegalParityIssue[] = [];
    const baseSections = countLegalSections(baseMarkdown);
    const otherSections = countLegalSections(otherMarkdown);
    if (baseSections !== otherSections) {
        issues.push({
            kind: 'section_count_mismatch',
            slug,
            locale,
            base: baseSections,
            other: otherSections,
        });
    }

    const baseCounts = countLegalPlaceholders(baseMarkdown);
    const otherCounts = countLegalPlaceholders(otherMarkdown);
    for (const token of LEGAL_PLACEHOLDER_TOKENS) {
        if (token === '[ADDRESS — required for EU trader info]') {
            const otherEu =
                otherCounts[token] +
                (locale === 'he'
                    ? countToken(otherMarkdown, LEGAL_EU_ADDRESS_TOKEN_HE)
                    : 0);
            if (baseCounts[token] !== otherEu) {
                issues.push({
                    kind: 'placeholder_mismatch',
                    slug,
                    locale,
                    token,
                    base: baseCounts[token],
                    other: otherEu,
                });
            }
            continue;
        }
        if (baseCounts[token] !== otherCounts[token]) {
            issues.push({
                kind: 'placeholder_mismatch',
                slug,
                locale,
                token,
                base: baseCounts[token],
                other: otherCounts[token],
            });
        }
    }

    return issues;
}

export function verifyAllLegalLocales(
    readFile: (slug: LegalSlug, locale: Language) => string | null,
): LegalParityIssue[] {
    const issues: LegalParityIssue[] = [];
    const slugs: LegalSlug[] = ['terms', 'privacy'];

    for (const slug of slugs) {
        const base = readFile(slug, 'en');
        if (!base) {
            issues.push({ kind: 'missing_file', slug, locale: 'en' });
            continue;
        }
        for (const locale of SUPPORTED_LANGUAGES) {
            const content = readFile(slug, locale);
            if (!content) {
                issues.push({ kind: 'missing_file', slug, locale });
                continue;
            }
            if (locale === 'en') continue;
            issues.push(...compareLegalMarkdownToBase(slug, base, locale, content));
        }
    }
    return issues;
}
