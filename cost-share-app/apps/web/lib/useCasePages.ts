/** Activation-aligned use-case landing pages (#413). */
export const USE_CASE_IDS = ['trip', 'roommates', 'event', 'couple'] as const;

export type UseCaseId = (typeof USE_CASE_IDS)[number];

export const USE_CASE_SLUGS: Record<UseCaseId, string> = {
    trip: 'trip-expenses',
    roommates: 'roommate-bills',
    event: 'event-expenses',
    couple: 'couple-expenses',
};

const slugToId = new Map<string, UseCaseId>(
    USE_CASE_IDS.map((id) => [USE_CASE_SLUGS[id], id]),
);

export function isUseCaseSlug(slug: string): slug is (typeof USE_CASE_SLUGS)[UseCaseId] {
    return slugToId.has(slug);
}

export function useCaseIdFromSlug(slug: string): UseCaseId | null {
    return slugToId.get(slug) ?? null;
}

export const USE_CASE_SLUG_LIST = USE_CASE_IDS.map((id) => USE_CASE_SLUGS[id]);
