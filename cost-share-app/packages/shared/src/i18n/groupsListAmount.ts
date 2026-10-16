import { formatMoney, type FormatMoneyOptions } from './formatMoney';

const ASCII_PLUS = '+';
const FULLWIDTH_PLUS = '\uFF0B';

/** Remove explicit plus prefixes from a formatted money string (RTL/LTR safe). */
export function stripPositiveAmountPlusPrefix(formatted: string): string {
    if (!formatted) return formatted;
    return formatted
        .split(`${ASCII_PLUS} `).join('')
        .split(ASCII_PLUS).join('')
        .split(`${FULLWIDTH_PLUS} `).join('')
        .split(FULLWIDTH_PLUS).join('');
}

export type FormatGroupsListAmountOptions = Pick<FormatMoneyOptions, 'language' | 'bidiIsolate'>;

/**
 * Groups list money display: magnitude only — no leading "+" on positive values.
 * Sign is conveyed by chip/summary color (green/red), not by a plus prefix.
 */
export function formatGroupsListAmount(
    amount: number,
    currencyCode: string,
    options?: FormatGroupsListAmountOptions,
): string {
    const formatted = formatMoney(amount, currencyCode, {
        ...options,
        absolute: true,
    });
    return amount >= 0 ? stripPositiveAmountPlusPrefix(formatted) : formatted;
}
