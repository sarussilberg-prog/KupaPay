import { loadStaticLegalDocument, type LegalSlug, type Language } from '@cost-share/shared';

export type WebLegalDocumentSource = 'static_bundle' | 'supabase_published';

/**
 * Web legal pages prefer bundled markdown (store / paywall compliance) before anon Supabase fetch.
 */
export function resolveWebLegalDocumentSource(
    slug: LegalSlug,
    locale: Language,
): WebLegalDocumentSource {
    return loadStaticLegalDocument(slug, locale) ? 'static_bundle' : 'supabase_published';
}

const EU_WITHDRAWAL_ACK_MARKERS = [
    'lose the right of withdrawal',
    'Widerrufsrecht verlieren',
    'pierdes el derecho de desistimiento',
    'perdez votre droit de rétractation',
    'זכות החזרה פוקעת',
    'утрачиваете право на отказ',
    'تفقد حق الانسحاب',
] as const;

/** Bundled terms must include EU withdrawal acknowledgement (#222 / paywall compliance). */
export function bundledTermsIncludeEuWithdrawalAck(locale: Language): boolean {
    const doc = loadStaticLegalDocument('terms', locale);
    if (!doc) return false;
    return EU_WITHDRAWAL_ACK_MARKERS.some((marker) => doc.content_md.includes(marker));
}
