import type { Language } from '../i18n/languages';
import type { LegalSlug } from '../types';

const TERMS_TITLE: Record<Language, string> = {
    en: 'Terms of Use',
    he: 'תנאי שימוש',
    ru: 'Условия использования',
    ar: 'شروط الاستخدام',
    fr: "Conditions d'utilisation",
    es: 'Términos de uso',
    de: 'Nutzungsbedingungen',
};

const PRIVACY_TITLE: Record<Language, string> = {
    en: 'Privacy Policy',
    he: 'מדיניות פרטיות',
    ru: 'Политика конфиденциальности',
    ar: 'سياسة الخصوصية',
    fr: 'Politique de confidentialité',
    es: 'Política de privacidad',
    de: 'Datenschutzerklärung',
};

export function legalDocumentTitle(slug: LegalSlug, locale: Language): string {
    return slug === 'terms' ? TERMS_TITLE[locale] : PRIVACY_TITLE[locale];
}
