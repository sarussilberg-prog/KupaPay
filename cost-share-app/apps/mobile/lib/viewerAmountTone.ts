/**
 * Maps a viewer's signed net (in currency units) to a display tone, and the
 * tone to a Tailwind color class. Single source of truth for coloring the main
 * amount text on transaction cards.
 *
 *   net > 0  → viewer is owed   → 'positive' → green
 *   net < 0  → viewer owes      → 'negative' → red
 *   net ~= 0 → settled / N/A    → 'neutral'  → black (gray-900)
 *
 * Green/red classes mirror the existing SummaryBalanceStrip CurrencyChip
 * convention (text-green-600 / text-red-500).
 */

export type ViewerAmountTone = 'positive' | 'negative' | 'neutral';

/** Below this magnitude a net is treated as settled (matches balance UI's 0.01 cutoff). */
const NET_EPSILON = 0.005;

export function viewerAmountTone(net: number): ViewerAmountTone {
    if (!Number.isFinite(net) || Math.abs(net) < NET_EPSILON) return 'neutral';
    return net > 0 ? 'positive' : 'negative';
}

export function viewerAmountToneClass(tone: ViewerAmountTone): string {
    switch (tone) {
        case 'positive':
            return 'text-green-600';
        case 'negative':
            return 'text-red-500';
        case 'neutral':
            return 'text-gray-900';
    }
}
