import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

test('check-free-tier-usage.mjs exits 0 without secrets', () => {
    const script = path.join(process.cwd(), 'scripts/check-free-tier-usage.mjs');
    const result = spawnSync(process.execPath, [script], {
        cwd: process.cwd(),
        encoding: 'utf8',
        env: {
            ...process.env,
            FREE_TIER_SENTRY_AUTH_TOKEN: '',
            FREE_TIER_POSTHOG_PERSONAL_API_KEY: '',
        },
    });
    assert.equal(result.status, 0);
    assert.match(result.stdout, /FREE_TIER_LIMITS/);
});
