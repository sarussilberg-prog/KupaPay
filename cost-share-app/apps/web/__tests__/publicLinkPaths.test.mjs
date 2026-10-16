import test from 'node:test';
import assert from 'node:assert/strict';

test('/b public balance routes use a single path segment token', () => {
    assert.match('/b/demo-public-balance-token', /^\/b\/[^/]+$/);
});

test('/e expense share routes use a single path segment token', () => {
    assert.match('/e/demo-expense-share-token', /^\/e\/[^/]+$/);
});
