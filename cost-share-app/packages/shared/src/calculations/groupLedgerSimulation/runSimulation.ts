import { assertLedgerInvariants, assertPairwiseMatchesReference } from './assertInvariants';
import { createPrng } from './prng';
import { createInitialState, pickOpKind, tryOp } from './simulator';
import type { SimulationRunOptions } from './types';
import type { SimOpKind, SimulationFailure, SimulationState } from './types';

export const DEFAULT_SIM_SEED = 641_641;
export const DEFAULT_SIM_OPS = 400;
export const CI_SIM_OPS = 350;

export function runSimulationWithAsserts(
    options: SimulationRunOptions,
): SimulationState {
    const rng = createPrng(options.seed);
    const state = createInitialState(options);

    const assertAt = (opIndex: number, opKind: SimOpKind | 'assert') => {
        try {
            assertLedgerInvariants(state);
            assertPairwiseMatchesReference(state);
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            const failure: SimulationFailure = {
                seed: options.seed,
                opIndex,
                opKind,
                message,
            };
            throw new Error(
                `Group ledger simulation failed seed=${failure.seed} opIndex=${failure.opIndex} op=${failure.opKind}: ${failure.message}`,
            );
        }
    };

    assertAt(-1, 'assert');

    for (let i = 0; i < 5; i++) {
        if (!tryOp(state, 'add_expense', rng)) i--;
        assertAt(-1, 'add_expense');
    }

    for (let op = 0; op < options.opCount; op++) {
        const kind = pickOpKind(rng);
        let attempts = 0;
        while (!tryOp(state, kind, rng) && attempts < 8) {
            attempts++;
        }
        assertAt(op, kind);
    }

    return state;
}

export function resolveSimulationOptions(
    overrides?: Partial<SimulationRunOptions>,
): SimulationRunOptions {
    const seed =
        overrides?.seed ??
        (process.env.GROUP_LEDGER_SIM_SEED
            ? Number(process.env.GROUP_LEDGER_SIM_SEED)
            : DEFAULT_SIM_SEED);
    const opCount =
        overrides?.opCount ??
        (process.env.GROUP_LEDGER_SIM_OPS
            ? Number(process.env.GROUP_LEDGER_SIM_OPS)
            : process.env.CI === 'true'
              ? CI_SIM_OPS
              : DEFAULT_SIM_OPS);
    return {
        seed,
        opCount,
        ...overrides,
    };
}
