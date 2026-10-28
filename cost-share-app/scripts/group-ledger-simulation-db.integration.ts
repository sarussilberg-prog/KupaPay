/**
 * Layer 2 (#641): replay seeded simulation ops against local CI Postgres and
 * compare get_user_simplified_inputs + _get_group_pairwise_debts_core to the
 * in-memory reference oracle.
 */
import { execSync } from 'node:child_process';
import { referenceNets, referencePairwiseDebts } from '../packages/shared/src/calculations/groupLedgerSimulation/referenceModel';
import { createPrng } from '../packages/shared/src/calculations/groupLedgerSimulation/prng';
import {
    CI_SIM_OPS,
    DEFAULT_SIM_SEED,
} from '../packages/shared/src/calculations/groupLedgerSimulation/runSimulation';
import {
    createInitialState,
    pickOpKind,
    tryOp,
} from '../packages/shared/src/calculations/groupLedgerSimulation/simulator';
import type { SimulationState } from '../packages/shared/src/calculations/groupLedgerSimulation/types';

const PG_CONTAINER = process.env.PG_CONTAINER ?? 'kupapay-sql-ci-postgres';
const DB_OPS = Number(process.env.GROUP_LEDGER_SIM_DB_OPS ?? Math.min(120, CI_SIM_OPS));
const SEED = Number(process.env.GROUP_LEDGER_SIM_SEED ?? DEFAULT_SIM_SEED);

const GROUP_ID = '00000000-0000-0000-0000-000000006411';
const CALLER_ID = '00000000-0000-0000-0000-000000006410';

function psql(sql: string): string {
    return execSync(
        `docker exec -e PGPASSWORD=postgres -i ${PG_CONTAINER} psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -tA -c ${JSON.stringify(sql)}`,
        { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 },
    ).trim();
}

function userUuid(userId: string): string {
    const n = userId.replace('u_', '');
    return `00000000-0000-0000-0000-${`00000000000${n}`.slice(-12)}`;
}

function expenseUuid(expenseId: string): string {
    const n = expenseId.replace('e_', '');
    return `00000000-0000-4000-8000-${`00000000000${n}`.slice(-12)}`;
}

function esc(s: string): string {
    return s.replace(/'/g, "''");
}

function bootstrapDb(): void {
    psql(`
BEGIN;
SET LOCAL session_replication_role = replica;
DELETE FROM public.settlements WHERE group_id = '${GROUP_ID}';
DELETE FROM public.expense_splits WHERE expense_id IN (SELECT id FROM public.expenses WHERE group_id = '${GROUP_ID}');
DELETE FROM public.expenses WHERE group_id = '${GROUP_ID}';
DELETE FROM public.group_members WHERE group_id = '${GROUP_ID}';
DELETE FROM public.groups WHERE id = '${GROUP_ID}';
`);

    const memberIds = ['u_0', 'u_1', 'u_2', 'u_3'];
    for (const uid of memberIds) {
        const id = userUuid(uid);
        psql(`
INSERT INTO auth.users (id) VALUES ('${id}') ON CONFLICT DO NOTHING;
INSERT INTO public.profiles (id, email, name, default_currency, language, is_active, invite_token)
VALUES ('${id}', '${esc(uid)}@sim.local', '${esc(uid)}', 'USD', 'en', TRUE, 'tt_${esc(uid)}')
ON CONFLICT (id) DO NOTHING;
`);
    }
    psql(`
INSERT INTO public.groups (id, name, default_currency, created_by, is_active, group_type, invite_token)
VALUES ('${GROUP_ID}', 'Ledger sim', 'USD', '${CALLER_ID}', TRUE, 'general', 'tt_sim641');
INSERT INTO public.group_members (group_id, user_id, is_active)
VALUES
  ('${GROUP_ID}', '${userUuid('u_0')}', TRUE),
  ('${GROUP_ID}', '${userUuid('u_1')}', TRUE),
  ('${GROUP_ID}', '${userUuid('u_2')}', TRUE),
  ('${GROUP_ID}', '${userUuid('u_3')}', TRUE);
CREATE OR REPLACE FUNCTION public.is_group_member(check_group_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS 'SELECT TRUE';
PERFORM public.test_set_authenticated('${CALLER_ID}');
COMMIT;
`);
}

function ensureMemberProfiles(state: SimulationState): void {
    for (const m of state.members) {
        const id = userUuid(m.userId);
        psql(`
INSERT INTO auth.users (id) VALUES ('${id}') ON CONFLICT DO NOTHING;
INSERT INTO public.profiles (id, email, name, default_currency, language, is_active, invite_token)
VALUES ('${id}', '${esc(m.userId)}@sim.local', '${esc(m.userId)}', 'USD', 'en', TRUE, 'tt_${esc(m.userId)}')
ON CONFLICT (id) DO NOTHING;
`);
    }
}

function syncStateToDb(state: SimulationState): void {
    psql(`
BEGIN;
SET LOCAL session_replication_role = replica;
DELETE FROM public.settlements WHERE group_id = '${GROUP_ID}';
DELETE FROM public.expense_splits WHERE expense_id IN (SELECT id FROM public.expenses WHERE group_id = '${GROUP_ID}');
DELETE FROM public.expenses WHERE group_id = '${GROUP_ID}';
`);

    ensureMemberProfiles(state);

    for (const m of state.members) {
        psql(`
INSERT INTO public.group_members (group_id, user_id, is_active)
VALUES ('${GROUP_ID}', '${userUuid(m.userId)}', ${m.isActive})
ON CONFLICT (group_id, user_id) DO UPDATE SET is_active = EXCLUDED.is_active;
`);
    }

    for (const e of state.expenses) {
        psql(`
INSERT INTO public.expenses (id, group_id, description, amount, currency, paid_by, created_by, split_mode, is_deleted, expense_date)
VALUES (
  '${expenseUuid(e.id)}',
  '${GROUP_ID}',
  'sim',
  ${e.amount},
  '${esc(e.currency)}',
  '${userUuid(e.paidBy)}',
  '${CALLER_ID}',
  '${esc(e.splitMode)}',
  ${e.isDeleted},
  CURRENT_DATE
);
`);
    }

    for (const s of state.splits) {
        psql(`
INSERT INTO public.expense_splits (expense_id, user_id, amount)
VALUES ('${expenseUuid(s.expenseId)}', '${userUuid(s.userId)}', ${s.amount});
`);
    }

    for (const st of state.settlements) {
        if (st.deletedAt) continue;
        psql(`
INSERT INTO public.settlements (group_id, from_user_id, to_user_id, amount, currency, created_by, settlement_date)
VALUES (
  '${GROUP_ID}',
  '${userUuid(st.fromUserId)}',
  '${userUuid(st.toUserId)}',
  ${st.amount},
  '${esc(st.currency)}',
  '${CALLER_ID}',
  CURRENT_DATE
);
`);
    }
    psql('COMMIT;');
}

function fetchSimplifiedNets(): Map<string, number> {
    const raw = psql(
        `SELECT public.get_user_simplified_inputs('${CALLER_ID}')::text;`,
    );
    const payload = JSON.parse(raw) as {
        groups: {
            groupId: string;
            currencies: { currency: string; nets: { userId: string; net: number }[] }[];
        }[];
    };
    const out = new Map<string, number>();
    const group = payload.groups.find(g => g.groupId === GROUP_ID);
    if (!group) return out;
    for (const cur of group.currencies) {
        for (const n of cur.nets) {
            out.set(`${n.userId}|${cur.currency}`, Number(n.net));
        }
    }
    return out;
}

function fetchPairwise(): string[] {
    const rows = psql(`
SELECT from_user_id::text || '|' || to_user_id::text || '|' || currency || '|' || to_char(amount, 'FM999999990.00')
FROM public._get_group_pairwise_debts_core('${GROUP_ID}')
ORDER BY 1;
`);
    if (!rows) return [];
    return rows.split('\n').filter(Boolean);
}

function assertDb(state: SimulationState, opIndex: number, opKind: string): void {
    syncStateToDb(state);
    const ref = referenceNets(state);
    const dbNets = fetchSimplifiedNets();

    for (const r of ref) {
        const uid = userUuid(r.userId);
        const key = `${uid}|${r.currency}`;
        const dbNet = dbNets.get(key);
        if (dbNet === undefined || Math.abs(Number((dbNet - r.net).toFixed(2))) > 0.01) {
            throw new Error(
                `DB simplified net mismatch seed=${SEED} op=${opIndex} kind=${opKind} key=${key} db=${dbNet} ref=${r.net}`,
            );
        }
    }

    const refPair = referencePairwiseDebts(state).map(
        p =>
            `${userUuid(p.fromUserId)}|${userUuid(p.toUserId)}|${p.currency}|${p.amount.toFixed(2)}`,
    );
    const dbPair = fetchPairwise();
    if (refPair.join('\n') !== dbPair.join('\n')) {
        throw new Error(
            `DB pairwise mismatch seed=${SEED} op=${opIndex} kind=${opKind}\nref:\n${refPair.join('\n')}\ndb:\n${dbPair.join('\n')}`,
        );
    }
}

function main(): void {
    if (execSync(`docker inspect -f '{{.State.Running}}' ${PG_CONTAINER}`, { encoding: 'utf8' }).trim() !== 'true') {
        console.error(`Postgres container ${PG_CONTAINER} is not running`);
        process.exit(1);
    }

    bootstrapDb();
    const rng = createPrng(SEED);
    const state = createInitialState({
        seed: SEED,
        opCount: DB_OPS,
        groupId: GROUP_ID,
    });

    for (let i = 0; i < 5; i++) {
        while (!tryOp(state, 'add_expense', rng)) {
            /* retry */
        }
        assertDb(state, -1, 'seed');
    }

    for (let op = 0; op < DB_OPS; op++) {
        const kind = pickOpKind(rng);
        let attempts = 0;
        while (!tryOp(state, kind, rng) && attempts < 8) attempts++;
        assertDb(state, op, kind);
    }

    console.log(`✅ Group ledger DB simulation passed (seed=${SEED}, ops=${DB_OPS})`);
}

main();
