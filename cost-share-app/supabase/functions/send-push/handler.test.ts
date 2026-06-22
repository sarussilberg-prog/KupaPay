import { assertEquals } from '@std/assert';
import { processActivityEvent, type ActivityRecord, type SendPushDeps } from './handler.ts';
import { classifyDelivery, type DeliveryStatus } from './dedup.ts';

function baseRecord(over: Partial<ActivityRecord> = {}): ActivityRecord {
    return {
        id: 'evt-1', user_id: 'u-recipient', kind: 'expense_added', group_id: 'g-1',
        ref_id: 'x-1', actor_user_id: 'u-actor', metadata: { description: 'Lunch', amount: 50, currency: 'ILS' },
        created_at: '2026-06-11T10:00:00Z', ...over,
    };
}

function fakeDeps(over: Partial<SendPushDeps> = {}): SendPushDeps & { sent: string[][] } {
    const sentTickets: string[][] = [];
    const deps: SendPushDeps & { sent: string[][] } = {
        sent: sentTickets,
        recordPending: () => Promise.resolve('new'),
        markSkipped: () => Promise.resolve(),
        markSent: (_id, tickets) => { sentTickets.push(tickets); return Promise.resolve(); },
        markFailed: () => Promise.resolve(),
        loadPreferences: () => Promise.resolve(null),
        loadActiveTokens: () => Promise.resolve([{ token: 'ExponentPushToken[a]' }]),
        resolveNames: () => Promise.resolve({ actorName: 'Dana', groupName: 'Trip' }),
        recipientLanguage: () => Promise.resolve('en'),
        unreadCount: () => Promise.resolve(3),
        disableToken: () => Promise.resolve(),
        sendExpo: () => Promise.resolve({ ticketIds: ['t-1'], invalidTokens: [] }),
        ...over,
    };
    return deps;
}

Deno.test('skips self events', async () => {
    const out = await processActivityEvent(baseRecord({ actor_user_id: 'u-recipient' }), fakeDeps());
    assertEquals(out, 'skipped_self');
});

Deno.test('skips events with no actor (self/system)', async () => {
    const out = await processActivityEvent(baseRecord({ actor_user_id: null }), fakeDeps());
    assertEquals(out, 'skipped_self');
});

Deno.test('skips when category preference is off', async () => {
    const deps = fakeDeps({
        loadPreferences: () => Promise.resolve({
            push_enabled: true, expenses_push: false, settlements_push: true,
            messages_push: true, friends_push: true, groups_push: true,
        }),
    });
    const out = await processActivityEvent(baseRecord(), deps);
    assertEquals(out, 'skipped_prefs');
});

Deno.test('skips when master switch is off', async () => {
    const deps = fakeDeps({
        loadPreferences: () => Promise.resolve({
            push_enabled: false, expenses_push: true, settlements_push: true,
            messages_push: true, friends_push: true, groups_push: true,
        }),
    });
    assertEquals(await processActivityEvent(baseRecord(), deps), 'skipped_prefs');
});

Deno.test('skips when no active tokens', async () => {
    const deps = fakeDeps({ loadActiveTokens: () => Promise.resolve([]) });
    assertEquals(await processActivityEvent(baseRecord(), deps), 'skipped_no_tokens');
});

Deno.test('sends and records tickets on happy path', async () => {
    const deps = fakeDeps();
    const out = await processActivityEvent(baseRecord(), deps);
    assertEquals(out, 'sent');
    assertEquals(deps.sent, [['t-1']]);
});

Deno.test('disables tokens flagged invalid by Expo', async () => {
    const disabled: string[] = [];
    const deps = fakeDeps({
        loadActiveTokens: () => Promise.resolve([{ token: 'ExponentPushToken[dead]' }]),
        sendExpo: () => Promise.resolve({ ticketIds: [], invalidTokens: ['ExponentPushToken[dead]'] }),
        disableToken: (t) => { disabled.push(t); return Promise.resolve(); },
    });
    await processActivityEvent(baseRecord(), deps);
    assertEquals(disabled, ['ExponentPushToken[dead]']);
});

Deno.test('returns duplicate when delivery already recorded', async () => {
    const deps = fakeDeps({ recordPending: () => Promise.resolve('duplicate') });
    assertEquals(await processActivityEvent(baseRecord(), deps), 'duplicate');
});

Deno.test('returns failed and calls markFailed when sendExpo throws', async () => {
    const failed: string[] = [];
    const deps = fakeDeps({
        sendExpo: () => Promise.reject(new Error('network')),
        markFailed: (_id, msg) => { failed.push(msg); return Promise.resolve(); },
    });
    const out = await processActivityEvent(baseRecord(), deps);
    assertEquals(out, 'failed');
    assertEquals(failed, ['network']);
});

Deno.test('forwards is_edited metadata into renderNotification', async () => {
    const sentBodies: string[] = [];
    const deps = fakeDeps({
        sendExpo: (msgs) => {
            for (const m of msgs) sentBodies.push(m.body);
            return Promise.resolve({ ticketIds: ['t-1'], invalidTokens: [] });
        },
    });
    const record = baseRecord({
        metadata: { description: 'Lunch', amount: 50, currency: 'ILS', is_edited: true },
    });
    await processActivityEvent(record, deps);
    assertEquals(sentBodies[0], 'Dana updated an expense · Lunch · ₪50');
});

Deno.test('forwards is_deleted metadata into renderNotification', async () => {
    const sentBodies: string[] = [];
    const deps = fakeDeps({
        sendExpo: (msgs) => {
            for (const m of msgs) sentBodies.push(m.body);
            return Promise.resolve({ ticketIds: ['t-1'], invalidTokens: [] });
        },
    });
    const record = baseRecord({
        metadata: { description: 'Lunch', amount: 50, currency: 'ILS', is_deleted: true },
    });
    await processActivityEvent(record, deps);
    assertEquals(sentBodies[0], 'Dana deleted an expense · Lunch');
});

// Regression for the edit/delete-no-push bug: edits/deletes reuse the same activity_events
// row (same id), only bumping created_at. The delivery store must treat each bumped revision
// as a fresh send while still dropping a duplicate trigger fire for the SAME revision.
Deno.test('re-sends on edit and delete; drops duplicate same-revision fire', async () => {
    const rows = new Map<string, { status: DeliveryStatus; event_created_at: string }>();
    const sentBodies: string[] = [];
    const deps = fakeDeps({
        recordPending: (eventId, _recipientId, eventCreatedAt) => {
            const decision = classifyDelivery(rows.get(eventId) ?? null, eventCreatedAt);
            if (decision === 'duplicate') return Promise.resolve('duplicate');
            rows.set(eventId, { status: 'pending', event_created_at: eventCreatedAt });
            return Promise.resolve('new');
        },
        markSent: (eventId) => {
            const r = rows.get(eventId);
            if (r) r.status = 'sent';
            return Promise.resolve();
        },
        sendExpo: (msgs) => {
            for (const m of msgs) sentBodies.push(m.body);
            return Promise.resolve({ ticketIds: ['t-1'], invalidTokens: [] });
        },
    });

    // 1. added
    assertEquals(
        await processActivityEvent(baseRecord({ created_at: '2026-06-22T10:00:00Z' }), deps),
        'sent',
    );
    // duplicate webhook delivery for the same revision → dropped
    assertEquals(
        await processActivityEvent(baseRecord({ created_at: '2026-06-22T10:00:00Z' }), deps),
        'duplicate',
    );
    // 2. edited (created_at bumped)
    assertEquals(
        await processActivityEvent(baseRecord({
            created_at: '2026-06-22T10:05:00Z',
            metadata: { description: 'Lunch', amount: 60, currency: 'ILS', is_edited: true },
        }), deps),
        'sent',
    );
    // 3. deleted (created_at bumped again)
    assertEquals(
        await processActivityEvent(baseRecord({
            created_at: '2026-06-22T10:09:00Z',
            metadata: { description: 'Lunch', amount: 60, currency: 'ILS', is_deleted: true },
        }), deps),
        'sent',
    );

    assertEquals(sentBodies, [
        'New expense from Dana · Lunch · ₪50',
        'Dana updated an expense · Lunch · ₪60',
        'Dana deleted an expense · Lunch',
    ]);
});
