import type { IsraeliPaymentApp } from '../../lib/israeliPaymentLinks';

/** Matches SettleUp method tiles (56×56, 14px radius) for visual parity. */
export const PAYMENT_APP_TILE_SIZE = 56;
export const PAYMENT_APP_TILE_RADIUS = 14;

/**
 * Monogram tiles in brand-adjacent colors. Official Bit/PayBox logo assets are
 * not embedded — no redistribution license verified in-repo (see PR #700).
 * Colors sourced from public app-store listing screenshots / brand guidelines
 * (Bit orange, PayBox sky blue).
 */
export const PAYMENT_APP_BRAND: Record<
    IsraeliPaymentApp,
    { backgroundColor: string; backgroundColorDark: string; monogram: string }
> = {
    bit: {
        backgroundColor: '#FF6F00',
        backgroundColorDark: '#E65100',
        monogram: 'bit',
    },
    paybox: {
        backgroundColor: '#5BC8F5',
        backgroundColorDark: '#039BE5',
        monogram: 'PB',
    },
};
