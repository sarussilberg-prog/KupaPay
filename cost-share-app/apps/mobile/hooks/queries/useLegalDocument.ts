import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { isLanguage, resolveLegalDocumentLocale, type LegalSlug, type Language } from '@cost-share/shared';
import { fetchLegalDocument } from '../../services/legal.service';
import { queryKeys } from './keys';

export function useLegalDocument(slug: LegalSlug) {
    const { i18n } = useTranslation();
    const code = i18n.language.split('-')[0];
    const locale: Language = isLanguage(code) ? code : resolveLegalDocumentLocale(i18n.language);

    return useQuery({
        queryKey: queryKeys.legalDocument(slug, locale),
        queryFn: () => fetchLegalDocument(slug, locale),
        staleTime: 5 * 60 * 1000,
        gcTime: 24 * 60 * 60 * 1000,
        retry: 1,
    });
}
