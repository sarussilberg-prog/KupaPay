import en from './locales/en.json' with { type: 'json' };
import he from './locales/he.json' with { type: 'json' };

export type Lang = 'he' | 'en';

export type ActivityKind =
    | 'expense_added' | 'settlement_added' | 'message_posted'
    | 'friend_request_received' | 'group_added' | 'group_member_joined' | 'group_removed';

export interface RenderParams {
    actorName: string;
    groupName: string;
    newMemberName?: string;
    description?: string | null;
    amount?: number | string | null;
    currency?: string | null;
    body?: string | null;
    isEdited?: boolean;
    isDeleted?: boolean;
}

export interface Rendered { title: string; body: string; }

type Variant = 'new' | 'edited' | 'deleted';

interface Messages {
    expense_added: Record<Variant, string>;
    settlement_added: Record<Variant, string>;
    message_posted: { edited: string; deleted: string };
    friend_request_received: { title: string; body: string };
    group_added: { title: string; body: string };
    group_member_joined: string;
    group_removed: string;
}

const LOCALES: Record<Lang, Messages> = { en: en as Messages, he: he as Messages };

const SYMBOLS: Record<string, string> = { ILS: '₪', USD: '$', EUR: '€', GBP: '£' };

export function formatMoney(amount: number | string | null | undefined, currency: string | null | undefined): string {
    const n = typeof amount === 'string' ? Number(amount) : (amount ?? 0);
    const value = Number.isFinite(n) ? (Number.isInteger(n) ? String(n) : n.toFixed(2)) : '0';
    const code = (currency ?? '').toUpperCase();
    const sym = SYMBOLS[code];
    return sym ? `${sym}${value}` : `${value} ${code}`.trim();
}

function joinDot(parts: Array<string | null | undefined>): string {
    return parts.map((p) => (p ?? '').trim()).filter((p) => p.length > 0).join(' · ');
}

function interpolate(template: string, vars: Record<string, string>): string {
    return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? '');
}

export function renderNotification(kind: ActivityKind, lang: Lang, p: RenderParams): Rendered {
    const t = LOCALES[lang];
    const money = formatMoney(p.amount, p.currency);
    const vars = { actor: p.actorName, group: p.groupName, member: p.newMemberName ?? '' };
    const variant: Variant = p.isDeleted ? 'deleted' : p.isEdited ? 'edited' : 'new';

    switch (kind) {
        case 'expense_added': {
            const phrase = interpolate(t.expense_added[variant], vars);
            // amount is omitted on delete (the expense no longer exists)
            const parts = p.isDeleted ? [phrase, p.description] : [phrase, p.description, money];
            return { title: p.groupName, body: joinDot(parts) };
        }
        case 'settlement_added': {
            const phrase = interpolate(t.settlement_added[variant], vars);
            const parts = p.isDeleted ? [phrase] : [phrase, money];
            return { title: p.groupName, body: joinDot(parts) };
        }
        case 'message_posted': {
            const title = joinDot([p.actorName, p.groupName]);
            if (p.isDeleted) return { title, body: interpolate(t.message_posted.deleted, vars) };
            if (p.isEdited) return { title, body: interpolate(t.message_posted.edited, vars) };
            return { title, body: (p.body ?? '').trim() };
        }
        case 'friend_request_received':
            return { title: t.friend_request_received.title, body: interpolate(t.friend_request_received.body, vars) };
        case 'group_added':
            return { title: t.group_added.title, body: joinDot([interpolate(t.group_added.body, vars), p.groupName]) };
        case 'group_member_joined':
            return { title: p.groupName, body: interpolate(t.group_member_joined, vars) };
        case 'group_removed':
            return { title: p.groupName, body: interpolate(t.group_removed, vars) };
    }
}
