import { assertEquals } from '@std/assert';
import { renderNotification, formatMoney } from './render.ts';

Deno.test('formatMoney uses symbol for known currency, code otherwise', () => {
    assertEquals(formatMoney(240, 'ILS'), '₪240');
    assertEquals(formatMoney('150.5', 'USD'), '$150.50');
    assertEquals(formatMoney(10, 'CHF'), '10 CHF');
});

Deno.test('expense_added renders he with group in title, no brackets', () => {
    const r = renderNotification('expense_added', 'he', {
        actorName: 'דנה', groupName: 'סופר וחברים', description: 'קניות', amount: 240, currency: 'ILS',
    });
    assertEquals(r.title, 'סופר וחברים');
    assertEquals(r.body, 'הוצאה חדשה מאת דנה · קניות · ₪240');
});

Deno.test('friend_request renders en', () => {
    const r = renderNotification('friend_request_received', 'en', { actorName: 'Dana', groupName: '' });
    assertEquals(r.title, 'New friend request');
    assertEquals(r.body, 'Dana wants to connect');
});

Deno.test('group_member_joined uses new member name', () => {
    const r = renderNotification('group_member_joined', 'he', {
        actorName: 'דנה', groupName: 'טיול', newMemberName: 'יוסי',
    });
    assertEquals(r.title, 'טיול');
    assertEquals(r.body, 'יוסי הצטרף/ה לקבוצה');
});

Deno.test('expense_added edited renders he', () => {
    const r = renderNotification('expense_added', 'he', {
        actorName: 'דנה', groupName: 'טיול', description: 'ארוחה', amount: 240, currency: 'ILS',
        isEdited: true,
    });
    assertEquals(r.title, 'טיול');
    assertEquals(r.body, 'הוצאה עודכנה על ידי דנה · ארוחה · ₪240');
});

Deno.test('expense_added edited renders en', () => {
    const r = renderNotification('expense_added', 'en', {
        actorName: 'Dana', groupName: 'Trip', description: 'Dinner', amount: 240, currency: 'ILS',
        isEdited: true,
    });
    assertEquals(r.body, 'Dana updated an expense · Dinner · ₪240');
});

Deno.test('expense_added deleted wins over edited', () => {
    const r = renderNotification('expense_added', 'en', {
        actorName: 'Dana', groupName: 'Trip', description: 'Dinner', amount: 240, currency: 'ILS',
        isEdited: true, isDeleted: true,
    });
    assertEquals(r.body, 'Dana deleted an expense · Dinner');
});

Deno.test('settlement_added edited en', () => {
    const r = renderNotification('settlement_added', 'en', {
        actorName: 'Dana', groupName: 'Trip', amount: 50, currency: 'ILS', isEdited: true,
    });
    assertEquals(r.body, 'Dana updated a payment · ₪50');
});

Deno.test('settlement_added deleted he', () => {
    const r = renderNotification('settlement_added', 'he', {
        actorName: 'דנה', groupName: 'טיול', amount: 50, currency: 'ILS', isDeleted: true,
    });
    assertEquals(r.body, 'תשלום נמחק על ידי דנה');
});

Deno.test('message_posted edited en uses neutral body', () => {
    const r = renderNotification('message_posted', 'en', {
        actorName: 'Dana', groupName: 'Trip', body: 'hi', isEdited: true,
    });
    assertEquals(r.title, 'Dana · Trip');
    assertEquals(r.body, 'Dana edited a message');
});

Deno.test('message_posted deleted he', () => {
    const r = renderNotification('message_posted', 'he', {
        actorName: 'דנה', groupName: 'טיול', body: 'שלום', isDeleted: true,
    });
    assertEquals(r.body, 'ההודעה נמחקה על ידי דנה');
});

Deno.test('group_deleted renders en/he with group title', () => {
    assertEquals(
        renderNotification('group_deleted', 'en', { actorName: 'Alice', groupName: 'Trip' }),
        { title: 'Trip', body: 'Deleted by Alice' },
    );
    assertEquals(
        renderNotification('group_deleted', 'he', { actorName: 'דנה', groupName: 'טיול' }),
        { title: 'טיול', body: 'נמחקה על ידי דנה' },
    );
});

Deno.test('group_note_changed renders en/he', () => {
    assertEquals(
        renderNotification('group_note_changed', 'en', { actorName: 'Alice', groupName: 'Trip' }),
        { title: 'Trip', body: 'Note changed by Alice' },
    );
    assertEquals(
        renderNotification('group_note_changed', 'he', { actorName: 'דנה', groupName: 'טיול' }),
        { title: 'טיול', body: 'הפתק שונה על ידי דנה' },
    );
});

Deno.test('friend_request_received rejected uses rejected push copy', () => {
    assertEquals(
        renderNotification('friend_request_received', 'en', { actorName: 'Bob', groupName: '', status: 'rejected' }),
        { title: 'Friend request declined', body: 'Bob declined your friend request' },
    );
});

Deno.test('friend_request_received pending unchanged', () => {
    assertEquals(
        renderNotification('friend_request_received', 'en', { actorName: 'Dana', groupName: '' }),
        { title: 'New friend request', body: 'Dana wants to connect' },
    );
});
