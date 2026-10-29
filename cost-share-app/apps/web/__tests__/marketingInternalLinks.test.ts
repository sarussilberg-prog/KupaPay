import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SUPPORTED_LANGUAGES } from '@cost-share/shared';
import { AMBASSADOR_PROGRAM_SLUG } from '../lib/ambassadorProgramPages';
import { SPLIT_CALCULATOR_SLUG } from '../lib/marketingSeo';
import { SPLITWISE_COMPARISON_SLUG } from '../lib/splitwiseComparisonPages';
import { TRAVEL_GUIDES_INDEX_SLUG, TRAVEL_GUIDE_SLUG_LIST } from '../lib/travelGuidesPages';
import { USE_CASE_SLUG_LIST } from '../lib/useCasePages';
import { WEB_APP_LOGIN_PATH } from '../lib/marketingAppRoutes';

const COMPONENTS_DIR = path.join(import.meta.dirname, '../app/_components');

const STATIC_MARKETING_PATHS = new Set([
    '/',
    '/privacy',
    '/terms',
    '/support',
    WEB_APP_LOGIN_PATH,
]);

function localePaths(slug: string): string[] {
    return SUPPORTED_LANGUAGES.map((locale) => `/${locale}/${slug}`);
}

function isAllowedInternalPath(href: string): boolean {
    if (href === '/' || STATIC_MARKETING_PATHS.has(href)) {
        return true;
    }
    if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:')) {
        return true;
    }
    if (href.startsWith('#')) {
        return true;
    }

    const allowedPrefixes = [
        ...SUPPORTED_LANGUAGES.map((locale) => `/${locale}`),
        ...localePaths(SPLIT_CALCULATOR_SLUG),
        ...localePaths(SPLITWISE_COMPARISON_SLUG),
        ...localePaths(TRAVEL_GUIDES_INDEX_SLUG),
        ...localePaths(AMBASSADOR_PROGRAM_SLUG),
        ...SUPPORTED_LANGUAGES.flatMap((locale) =>
            USE_CASE_SLUG_LIST.map((slug) => `/${locale}/${slug}`),
        ),
        ...SUPPORTED_LANGUAGES.flatMap((locale) =>
            TRAVEL_GUIDE_SLUG_LIST.map((slug) => `/${locale}/${TRAVEL_GUIDES_INDEX_SLUG}/${slug}`),
        ),
    ];

    return allowedPrefixes.some((prefix) => href === prefix || href.startsWith(`${prefix}/`));
}

function collectStringHrefs(source: string): string[] {
    const hrefs: string[] = [];
    const patterns = [
        /href="(\/[^"]*)"/g,
        /href='(\/[^']*)'/g,
        /href=\{\s*['"](\/[^'"]+)['"]\s*\}/g,
    ];
    for (const pattern of patterns) {
        for (const match of source.matchAll(pattern)) {
            hrefs.push(match[1]);
        }
    }
    return hrefs;
}

test('marketing components only link to known marketing or app entry paths', () => {
    const files = fs.readdirSync(COMPONENTS_DIR).filter((name) => name.endsWith('.tsx'));
    const violations: string[] = [];

    for (const file of files) {
        const source = fs.readFileSync(path.join(COMPONENTS_DIR, file), 'utf8');
        for (const href of collectStringHrefs(source)) {
            if (!isAllowedInternalPath(href)) {
                violations.push(`${file}: ${href}`);
            }
        }
    }

    assert.deepEqual(violations, []);
});

test('sign-in CTAs use the canonical login path', () => {
    const loginLinkFiles = ['StoreDownloadBadges.tsx', 'AmbassadorProgramForm.tsx'];
    for (const file of loginLinkFiles) {
        const source = fs.readFileSync(path.join(COMPONENTS_DIR, file), 'utf8');
        assert.match(source, new RegExp(`href="${WEB_APP_LOGIN_PATH.replace('/', '\\/')}"`));
    }
});
