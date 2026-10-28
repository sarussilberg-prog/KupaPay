import * as fc from 'fast-check';
import {
    CI_SIM_OPS,
    DEFAULT_SIM_SEED,
    resolveSimulationOptions,
    runSimulationWithAsserts,
} from '../groupLedgerSimulation';

describe('group ledger simulation (#641)', () => {
    it('long run: client nets and invariants match reference after every op', () => {
        const opts = resolveSimulationOptions({
            seed: DEFAULT_SIM_SEED,
            opCount: CI_SIM_OPS,
        });
        expect(() => runSimulationWithAsserts(opts)).not.toThrow();
    });

    it('property: balanced random seeds complete without invariant violations', () => {
        fc.assert(
            fc.property(fc.integer({ min: 1, max: 0x7fffffff }), seed => {
                runSimulationWithAsserts({
                    seed,
                    opCount: 80,
                    initialMemberCount: 3,
                });
            }),
            { numRuns: 12, seed: 641641, endOnFailure: true },
        );
    });
});
