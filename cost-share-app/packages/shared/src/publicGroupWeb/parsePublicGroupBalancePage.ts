import type { PublicGroupBalancePageWire } from './types';

export function parsePublicGroupBalancePageWire(raw: unknown): PublicGroupBalancePageWire {
    if (!raw || typeof raw !== 'object') return { ok: false };
    const o = raw as Record<string, unknown>;
    if (o.ok !== true) return { ok: false };
    const group = o.group;
    if (!group || typeof group !== 'object') return { ok: false };
    const g = group as Record<string, unknown>;
    if (typeof g.name !== 'string' || typeof g.default_currency !== 'string') {
        return { ok: false };
    }
    return raw as PublicGroupBalancePageWire;
}
