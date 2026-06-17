import { SimplifiedInputsPayload } from '@cost-share/shared';

export const ARI = 'u_ari';
export const BAR = 'u_bar';
export const NAVEH = 'u_naveh';
export const SARUS = 'u_sarus';

export const BLALA = 'g_blala';
export const PARIS = 'g_paris';
export const DFG = 'g_dfg';

export const member = (userId: string, name: string) => ({
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
