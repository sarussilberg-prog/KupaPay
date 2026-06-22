export type DeliveryStatus = 'pending' | 'sent' | 'failed' | 'skipped';

export interface ExistingDelivery {
    status: DeliveryStatus;
    event_created_at: string;
}

// 'new'      → no row yet, or a prior attempt that may be retried at the same revision.
// 'revised'  → the event was edited/deleted since the last delivery (its created_at bumped),
//              so this is a genuinely new notification that must (re)send.
// 'duplicate'→ the same revision is already in-flight or delivered; drop it.
export type DeliveryDecision = 'new' | 'revised' | 'duplicate';

// Edits and deletes reuse the same activity_events row, bumping its created_at so the push
// trigger re-fires. Comparing that timestamp against the revision we last processed lets us
// tell a real new notification from a duplicate trigger delivery for the same revision.
export function classifyDelivery(
    existing: ExistingDelivery | null,
    incomingCreatedAt: string,
): DeliveryDecision {
    if (!existing) return 'new';
    if (new Date(incomingCreatedAt).getTime() > new Date(existing.event_created_at).getTime()) {
        return 'revised';
    }
    return existing.status === 'sent' || existing.status === 'pending' ? 'duplicate' : 'new';
}
