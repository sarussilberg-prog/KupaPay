import test from 'node:test';
import assert from 'node:assert/strict';
import {
    bundledTermsIncludeEuWithdrawalAck,
    resolveWebLegalDocumentSource,
} from '../lib/webLegalDocumentSource.ts';

test('resolveWebLegalDocumentSource prefers bundled markdown for terms and privacy', () => {
    assert.equal(resolveWebLegalDocumentSource('terms', 'en'), 'static_bundle');
    assert.equal(resolveWebLegalDocumentSource('privacy', 'he'), 'static_bundle');
});

test('bundledTermsIncludeEuWithdrawalAck is present for store paywall compliance locales', () => {
    assert.equal(bundledTermsIncludeEuWithdrawalAck('en'), true);
    assert.equal(bundledTermsIncludeEuWithdrawalAck('de'), true);
});
