import fs from 'fs';
import path from 'path';
import {
    applyLegalPlaceholders,
    legalDocumentLocale,
    legalDocumentTitle,
    type LegalSlug,
} from '@cost-share/shared';
import type { Language } from '@cost-share/shared';

const CONTENT_DIR = path.join(process.cwd(), 'content', 'legal');

export type StaticLegalDocument = {
    title: string;
    content_md: string;
    effective_date: string;
    source: 'static';
};

export function loadStaticLegalDocument(
    slug: LegalSlug,
    locale: Language,
): StaticLegalDocument | null {
    const docLocale = legalDocumentLocale(locale);
    const file = path.join(CONTENT_DIR, `${slug}.${docLocale}.md`);
    if (!fs.existsSync(file)) return null;
    const raw = fs.readFileSync(file, 'utf8');
    return {
        title: legalDocumentTitle(slug, docLocale),
        content_md: applyLegalPlaceholders(raw),
        effective_date: applyLegalPlaceholders('[DATE]'),
        source: 'static',
    };
}
