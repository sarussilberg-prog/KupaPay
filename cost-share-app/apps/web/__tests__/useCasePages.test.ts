import test from 'node:test';
import assert from 'node:assert/strict';
import {
    USE_CASE_IDS,
    USE_CASE_SLUGS,
    isUseCaseSlug,
    useCaseIdFromSlug,
} from '../lib/useCasePages';
import { useCasePath, useCaseUrl } from '../lib/marketingSeo';

test('use case slugs map to stable ids', () => {
    for (const id of USE_CASE_IDS) {
        const slug = USE_CASE_SLUGS[id];
        assert.equal(isUseCaseSlug(slug), true);
        assert.equal(useCaseIdFromSlug(slug), id);
    }
    assert.equal(isUseCaseSlug('split-calculator'), false);
});

test('useCasePath and useCaseUrl include locale and slug', () => {
    assert.equal(useCasePath('he', 'trip'), '/he/trip-expenses');
    assert.match(useCaseUrl('en', 'roommates'), /^https:\/\/kupa-pay\.com\/en\/roommate-bills$/);
});
