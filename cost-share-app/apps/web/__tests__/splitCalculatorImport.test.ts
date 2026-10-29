import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildSplitCalculatorImportPlan,
    validateSplitCalculatorImportDraft,
} from '../lib/splitCalculatorImport';
import {
    parseSplitCalculatorImportDraft,
    SPLIT_CALCULATOR_IMPORT_DRAFT_KEY,
} from '../lib/splitCalculatorImportDraft';
import type { SplitCalculatorImportDraft } from '../lib/splitCalculatorImportDraft';

const baseDraft = (): SplitCalculatorImportDraft => ({
    groupName: 'Weekend trip',
    selfParticipantId: 'self',
    currency: 'USD',
    participants: [
        { id: 'self', name: 'Me' },
        { id: 'friend', name: 'Sam' },
    ],
    expenses: [
        {
            id: 'e1',
            payerId: 'self',
            amount: 90,
            participantIds: ['self', 'friend'],
        },
        {
            id: 'e2',
            payerId: 'friend',
            amount: 30,
            participantIds: ['self', 'friend'],
        },
    ],
});

test('validateSplitCalculatorImportDraft rejects empty group name', () => {
    const draft = { ...baseDraft(), groupName: '   ' };
    assert.equal(validateSplitCalculatorImportDraft(draft), 'empty_group_name');
});

test('validateSplitCalculatorImportDraft accepts balanced calculator data', () => {
    assert.equal(validateSplitCalculatorImportDraft(baseDraft()), null);
});

test('buildSplitCalculatorImportPlan maps guests and equal splits', () => {
    const draft = baseDraft();
    const guestIds = new Map<string, string>([['friend', 'guest-uuid']]);
    const plan = buildSplitCalculatorImportPlan(
        draft,
        'user-uuid',
        guestIds,
        (n) => `Expense ${n}`,
    );

    assert.equal(plan.groupName, 'Weekend trip');
    assert.equal(plan.defaultCurrency, 'USD');
    assert.deepEqual(plan.guestParticipantIds, ['friend']);
    assert.equal(plan.participantUserIds.get('self'), 'user-uuid');
    assert.equal(plan.participantUserIds.get('friend'), 'guest-uuid');
    assert.equal(plan.expenses.length, 2);
    assert.equal(plan.expenses[0]?.paidBy, 'user-uuid');
    assert.equal(plan.expenses[0]?.splits.length, 2);
    assert.equal(plan.expenses[0]?.description, 'Expense 1');
});

test('parseSplitCalculatorImportDraft validates persisted shape', () => {
    const raw = JSON.stringify(baseDraft());
    const parsed = parseSplitCalculatorImportDraft(raw);
    assert.ok(parsed);
    assert.equal(parsed?.groupName, 'Weekend trip');
    assert.equal(parseSplitCalculatorImportDraft('{not-json'), null);
    assert.equal(SPLIT_CALCULATOR_IMPORT_DRAFT_KEY.includes('split_calculator'), true);
});
