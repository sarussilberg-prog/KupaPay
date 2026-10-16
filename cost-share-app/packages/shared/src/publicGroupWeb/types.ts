export type PublicGroupWebViewPayload =
    | { kind: 'not_found' }
    | {
          kind: 'ok';
          group: { name: string; currency: string };
          members: Array<{ displayName: string }>;
          balances: Array<{ displayName: string; currency: string; net: number }>;
          debts: Array<{ fromName: string; toName: string; currency: string; amount: number }>;
          recentExpenses: Array<{
              description: string;
              amount: number;
              currency: string;
              expenseDate: string;
              paidByName: string;
          }>;
      };

function asRecord(v: unknown): Record<string, unknown> | null {
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
}

export function parsePublicGroupWebViewPayload(raw: unknown): PublicGroupWebViewPayload {
    const o = asRecord(raw);
    if (!o || o.kind !== 'ok') {
        return { kind: 'not_found' };
    }
    const group = asRecord(o.group);
    if (!group || typeof group.name !== 'string' || typeof group.currency !== 'string') {
        return { kind: 'not_found' };
    }

    const members = Array.isArray(o.members)
        ? o.members
              .map((m) => asRecord(m))
              .filter((m): m is Record<string, unknown> => !!m && typeof m.displayName === 'string')
              .map((m) => ({ displayName: m.displayName as string }))
        : [];

    const balances = Array.isArray(o.balances)
        ? o.balances
              .map((b) => asRecord(b))
              .filter(
                  (b): b is Record<string, unknown> =>
                      !!b &&
                      typeof b.displayName === 'string' &&
                      typeof b.currency === 'string' &&
                      typeof b.net === 'number',
              )
              .map((b) => ({
                  displayName: b.displayName as string,
                  currency: b.currency as string,
                  net: b.net as number,
              }))
        : [];

    const debts = Array.isArray(o.debts)
        ? o.debts
              .map((d) => asRecord(d))
              .filter(
                  (d): d is Record<string, unknown> =>
                      !!d &&
                      typeof d.fromName === 'string' &&
                      typeof d.toName === 'string' &&
                      typeof d.currency === 'string' &&
                      typeof d.amount === 'number',
              )
              .map((d) => ({
                  fromName: d.fromName as string,
                  toName: d.toName as string,
                  currency: d.currency as string,
                  amount: d.amount as number,
              }))
        : [];

    const recentExpenses = Array.isArray(o.recentExpenses)
        ? o.recentExpenses
              .map((e) => asRecord(e))
              .filter(
                  (e): e is Record<string, unknown> =>
                      !!e &&
                      typeof e.description === 'string' &&
                      typeof e.amount === 'number' &&
                      typeof e.currency === 'string' &&
                      typeof e.expenseDate === 'string' &&
                      typeof e.paidByName === 'string',
              )
              .map((e) => ({
                  description: e.description as string,
                  amount: e.amount as number,
                  currency: e.currency as string,
                  expenseDate: e.expenseDate as string,
                  paidByName: e.paidByName as string,
              }))
        : [];

    return {
        kind: 'ok',
        group: { name: group.name, currency: group.currency },
        members,
        balances,
        debts,
        recentExpenses,
    };
}
