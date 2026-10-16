import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    DEFAULT_LANGUAGE,
    loadStaticLegalDocument,
    type LegalDocument,
    type LegalSlug,
    type Language,
} from '@cost-share/shared';
import { supabase } from '../lib/supabase';

const TABLE = 'legal_documents';

const cacheKey = (slug: LegalSlug, locale: Language) => `legal:${slug}:${locale}`;

type Row = {
    id: string;
    slug: LegalSlug;
    locale: Language;
    version: string;
    title: string;
    content_md: string;
    effective_date: string;
    updated_at: string;
};

function mapRow(row: Row): LegalDocument {
    return {
        id: row.id,
        slug: row.slug,
        locale: row.locale,
        version: row.version,
        title: row.title,
        contentMd: row.content_md,
        effectiveDate: row.effective_date,
        updatedAt: row.updated_at,
    };
}

function mapStatic(slug: LegalSlug, locale: Language): LegalDocument | null {
    const doc = loadStaticLegalDocument(slug, locale);
    if (!doc) return null;
    return {
        id: `static:${slug}:${doc.locale}`,
        slug,
        locale: doc.locale,
        version: 'static',
        title: doc.title,
        contentMd: doc.content_md,
        effectiveDate: doc.effective_date,
        updatedAt: doc.effective_date,
    };
}

async function readCache(slug: LegalSlug, locale: Language): Promise<LegalDocument | null> {
    try {
        const raw = await AsyncStorage.getItem(cacheKey(slug, locale));
        return raw ? (JSON.parse(raw) as LegalDocument) : null;
    } catch {
        return null;
    }
}

async function writeCache(doc: LegalDocument): Promise<void> {
    try {
        await AsyncStorage.setItem(cacheKey(doc.slug, doc.locale), JSON.stringify(doc));
    } catch {
        // Cache write failures are non-fatal.
    }
}

export async function fetchLegalDocument(
    slug: LegalSlug,
    locale: Language,
): Promise<LegalDocument> {
    const staticDoc = mapStatic(slug, locale) ?? mapStatic(slug, DEFAULT_LANGUAGE);
    if (staticDoc) {
        await writeCache(staticDoc);
        return staticDoc;
    }

    const { data, error } = await supabase
        .from(TABLE)
        .select('id, slug, locale, version, title, content_md, effective_date, updated_at')
        .eq('slug', slug)
        .eq('locale', locale)
        .eq('is_published', true)
        .maybeSingle();

    if (error) {
        const cached = await readCache(slug, locale);
        if (cached) return cached;
        throw new Error(`legal.fetch failed: ${(error as Error).message ?? 'unknown'}`);
    }

    if (!data) {
        const cached = await readCache(slug, locale);
        if (cached) return cached;
        throw new Error(`legal.fetch: document not found (${slug}/${locale})`);
    }

    const doc = mapRow(data as Row);
    await writeCache(doc);
    return doc;
}
