/** ISO 3166-1 alpha-2 — EEA + UK + CH (EU consumer / privacy conservative gate). */
export const EU_EEA_UK_CH_REGIONS = new Set([
    'AT',
    'BE',
    'BG',
    'HR',
    'CY',
    'CZ',
    'DK',
    'EE',
    'FI',
    'FR',
    'DE',
    'GR',
    'HU',
    'IE',
    'IT',
    'LV',
    'LT',
    'LU',
    'MT',
    'NL',
    'PL',
    'PT',
    'RO',
    'SK',
    'SI',
    'ES',
    'SE',
    'IS',
    'LI',
    'NO',
    'GB',
    'UK',
    'CH',
]);

export function isEuEeaUkChRegion(regionCode?: string | null): boolean {
    const code = regionCode?.toUpperCase();
    if (!code) return false;
    return EU_EEA_UK_CH_REGIONS.has(code);
}
