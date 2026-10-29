/** Evergreen travel & group money guides (#416). */
export const TRAVEL_GUIDES_INDEX_SLUG = 'guides';

export const TRAVEL_GUIDE_IDS = [
    'groupTripSplit',
    'cashVsCardAbroad',
    'multiCurrencyGroups',
    'settleUpAfterTravel',
    'japanTravelMoney',
    'thailandTravelMoney',
    'europeTravelMoney',
    'ukTravelMoney',
    'usaTravelMoney',
    'tippingWhileTraveling',
] as const;

export type TravelGuideId = (typeof TRAVEL_GUIDE_IDS)[number];

export const TRAVEL_GUIDE_SLUGS: Record<TravelGuideId, string> = {
    groupTripSplit: 'splitting-costs-on-a-group-trip',
    cashVsCardAbroad: 'cash-vs-card-when-traveling',
    multiCurrencyGroups: 'multi-currency-group-expenses',
    settleUpAfterTravel: 'settle-up-after-a-trip',
    japanTravelMoney: 'japan-travel-money-tips',
    thailandTravelMoney: 'thailand-travel-money-tips',
    europeTravelMoney: 'europe-travel-money-tips',
    ukTravelMoney: 'uk-travel-money-tips',
    usaTravelMoney: 'usa-travel-money-tips',
    tippingWhileTraveling: 'tipping-when-traveling-abroad',
};

const slugToId = new Map<string, TravelGuideId>(
    TRAVEL_GUIDE_IDS.map((id) => [TRAVEL_GUIDE_SLUGS[id], id]),
);

export function isTravelGuideSlug(slug: string): slug is (typeof TRAVEL_GUIDE_SLUGS)[TravelGuideId] {
    return slugToId.has(slug);
}

export function travelGuideIdFromSlug(slug: string): TravelGuideId | null {
    return slugToId.get(slug) ?? null;
}

export const TRAVEL_GUIDE_SLUG_LIST = TRAVEL_GUIDE_IDS.map((id) => TRAVEL_GUIDE_SLUGS[id]);
