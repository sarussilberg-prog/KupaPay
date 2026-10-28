import test from 'node:test';
import assert from 'node:assert/strict';
import {
    computeSplitCalculatorTransfers,
    type SplitCalculatorExpense,
    type SplitCalculatorParticipant,
} from '../lib/splitCalculatorLogic';
import {
    decodeSplitCalculatorShare,
    encodeSplitCalculatorShare,
} from '../lib/splitCalculatorShare';

const alice: SplitCalculatorParticipant = { id: 'a', name: 'Alice' };
const bob: SplitCalculatorParticipant = { id: 'b', name: 'Bob' };
const charlie: SplitCalculatorParticipant = { id: 'c', name: 'Charlie' };

test('computeSplitCalculatorTransfers simplifies a three-person dinner', () => {
    const expenses: SplitCalculatorExpense[] = [
        {
            id: 'e1',
            payerId: 'a',
            amount: 90,
            participantIds: ['a', 'b', 'c'],
        },
    ];
    const result = computeSplitCalculatorTransfers([alice, bob, charlie], expenses, 'USD');
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.transfers.length, 2);
    const total = result.transfers.reduce((s, t) => s + t.amount, 0);
    assert.equal(Number(total.toFixed(2)), 60);
});

test('computeSplitCalculatorTransfers rejects empty input', () => {
    assert.deepEqual(computeSplitCalculatorTransfers([], [], 'USD'), {
        ok: false,
        error: 'no_participants',
    });
});

test('share codec round-trips calculator state', () => {
    const payload = {
        currency: 'ILS',
        participants: [alice, bob],
        expenses: [
            {
                id: 'e1',
                payerId: 'a',
                amount: 50,
                participantIds: ['a', 'b'],
            },
        ] satisfies SplitCalculatorExpense[],
    };
    const hash = encodeSplitCalculatorShare(payload);
    const decoded = decodeSplitCalculatorShare(`#${hash}`);
    assert.deepEqual(decoded, payload);
});
