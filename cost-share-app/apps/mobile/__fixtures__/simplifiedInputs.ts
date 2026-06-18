import { SimplifiedInputsPayload } from '@cost-share/shared';

export const ARI = 'u_ari';
export const BAR = 'u_bar';
export const NAVEH = 'u_naveh';
export const SARUS = 'u_sarus';
export const GHOST = 'u_ghost'; // deleted account: RPC returns name = null

export const BLALA = 'g_blala';
export const PARIS = 'g_paris';
export const DFG = 'g_dfg';

// `name` is null for deleted accounts (delete_my_account anonymises profiles.name).
export const member = (userId: string, name: string | null) => ({
    userId,
    name,
    avatarUrl: null,
});

/** All-settled group: no nonzero currencies → group absent from RPC. */
export const all_settled: SimplifiedInputsPayload = {
    groups: [],
};

/** 3 members, IRR is a perfect 3-way cycle (Ari→Bar→Naveh→Ari, each 7.33). */
export const cycle_blala: SimplifiedInputsPayload = {
    groups: [
        {
            groupId: BLALA,
            members: [member(ARI, 'Ari'), member(BAR, 'Bar'), member(NAVEH, 'Naveh')],
            currencies: [
                {
                    currency: 'IRR',
                    nets: [
                        { userId: ARI, net: 0 },
                        { userId: BAR, net: 0 },
                        { userId: NAVEH, net: 0 },
                    ],
                },
            ],
        },
    ],
};

/** 3 members, ILS; Sarus paid 44 split 14.66/14.68/14.66. Per-user nets: Sarus +29.34, Ari -14.68, Naveh -14.66. */
export const residual_paris: SimplifiedInputsPayload = {
    groups: [
        {
            groupId: PARIS,
            members: [member(ARI, 'Ari'), member(NAVEH, 'Naveh'), member(SARUS, 'Sarus')],
            currencies: [
                {
                    currency: 'ILS',
                    nets: [
                        { userId: ARI, net: -14.68 },
                        { userId: NAVEH, net: -14.66 },
                        { userId: SARUS, net: 29.34 },
                    ],
                },
            ],
        },
    ],
};

/**
 * Corrupt ledger: the per-currency nets do NOT sum to zero (e.g. an expense
 * whose splits don't add up to its amount). simplifyDebts rejects this; the
 * model must SURFACE it in `unbalanced`, never silently drop it as "settled".
 * Sarus +20, Ari -10 → residual +10.
 */
export const unbalanced_dinner: SimplifiedInputsPayload = {
    groups: [
        {
            groupId: DFG,
            members: [member(ARI, 'Ari'), member(SARUS, 'Sarus')],
            currencies: [
                {
                    currency: 'ILS',
                    nets: [
                        { userId: ARI, net: -10 },
                        { userId: SARUS, net: 20 },
                    ],
                },
            ],
        },
    ],
};

/**
 * A deleted-account counterparty: their profile name is NULL (anonymised). They
 * still owe the current user (Sarus +15, Ghost -15 → balanced), so they must
 * appear in friendBalances flagged isActive:false → the UI renders "deleted user"
 * rather than crashing on the null name or hiding the debt.
 */
export const deleted_friend: SimplifiedInputsPayload = {
    groups: [
        {
            groupId: DFG,
            members: [member(SARUS, 'Sarus'), member(GHOST, null)],
            currencies: [
                {
                    currency: 'ILS',
                    nets: [
                        { userId: SARUS, net: 15 },
                        { userId: GHOST, net: -15 },
                    ],
                },
            ],
        },
    ],
};

/** Blala with the "Ba" USD 10 expense layered on top of the IRR cycle. */
export const multi_currency_blala: SimplifiedInputsPayload = {
    groups: [
        {
            groupId: BLALA,
            members: [member(ARI, 'Ari'), member(BAR, 'Bar'), member(NAVEH, 'Naveh')],
            currencies: [
                {
                    currency: 'IRR',
                    nets: [
                        { userId: ARI, net: 0 },
                        { userId: BAR, net: 0 },
                        { userId: NAVEH, net: 0 },
                    ],
                },
                {
                    currency: 'USD',
                    nets: [
                        { userId: ARI, net: 6.67 },
                        { userId: BAR, net: -3.33 },
                        { userId: NAVEH, net: -3.34 },
                    ],
                },
            ],
        },
    ],
};

/** Avraham (Ari) in 2 groups: residual_paris (ILS) + blala (USD only). Same friend (Naveh) in both. */
export const multi_group: SimplifiedInputsPayload = {
    groups: [
        residual_paris.groups[0],
        {
            groupId: BLALA,
            members: [member(ARI, 'Ari'), member(BAR, 'Bar'), member(NAVEH, 'Naveh')],
            currencies: [
                {
                    currency: 'USD',
                    nets: [
                        { userId: ARI, net: 6.67 },
                        { userId: BAR, net: -3.33 },
                        { userId: NAVEH, net: -3.34 },
                    ],
                },
            ],
        },
    ],
};
