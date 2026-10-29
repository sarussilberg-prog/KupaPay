import { assertLedgerInvariants } from './assertInvariants';
import { createInitialState, replayGroupLedgerOps } from './simulator';
import type { SimOpKind, SimulationFailure, SimulationRunOptions, SimulationState } from './types';

export const DEFAULT_SIM_SEED = 641_641;
const DEFAULT_SIM_OPS = 400;
export const CI_SIM_OPS = 350;

export function runSimulationWithAsserts(
    options: SimulationRunOptions,
): SimulationState {
    const state = createInitialState(options);

    const assertAt = (opIndex: number, opKind: SimOpKind | 'seed') => {
        try {
            assertLedgerInvariants(state);
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            const failure: SimulationFailure = {
                seed: options.seed,
                opIndex,
                opKind: opKind === 'seed' ? 'assert' : opKind,
                message,
            };
            throw new Error(
                `Group ledger simulation failed seed=${failure.seed} opIndex=${failure.opIndex} op=${failure.opKind}: ${failure.message}`,
            );
        }
    };

    replayGroupLedgerOps(state, options.seed, options.opCount, ({ opIndex, opKind }) =>
        assertAt(opIndex, opKind),
    );

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
