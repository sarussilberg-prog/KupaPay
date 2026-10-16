/**
 * Owner / trader placeholders for Terms and Privacy.
 * Single SSOT — web legal pages and mobile paywall links use the same values.
 */
export const OWNER_LEGAL_CONFIG = {
    /** Operator name shown in Terms, Privacy, and store listings. */
    operatorDisplayName: 'Sarussilberg',
    /** Individual legally responsible (trader). */
    legalResponsibleName: 'Nave Sarussi',
    /** Replaces [OWNER LEGAL NAME] in draft markdown. */
    ownerLegalName: 'Sarussilberg',
    /** Support and privacy contact email. */
    supportEmail: 'sarussilberg@gmail.com',
    /** Public postal address (English). */
    address: 'Shlomo HaMelech 41, Lod 7136477, Israel',
    /** Public postal address (Hebrew). */
    addressHe: 'שלמה המלך 41, לוד 7136477, ישראל',
    /** ISO date string shown as "Last updated" when [DATE] appears in drafts. */
    lastUpdated: '2026-10-16',
} as const;

export { applyLegalPlaceholders } from './legalPlaceholders';
export { legalDocumentTitle } from './legalTitles';
