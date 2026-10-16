import { describe, it, expect } from '@jest/globals';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

describe('check-free-tier-usage.mjs', () => {
    it('exits 0 without secrets (checklist mode)', () => {
        const script = path.join(process.cwd(), 'scripts/check-free-tier-usage.mjs');
        const result = spawnSync(process.execPath, [script], {
            cwd: path.join(process.cwd()),
            encoding: 'utf8',
            env: { ...process.env, FREE_TIER_SENTRY_AUTH_TOKEN: '', FREE_TIER_POSTHOG_PERSONAL_API_KEY: '' },
        });
        expect(result.status).toBe(0);
        expect(result.stdout).toMatch(/FREE_TIER_LIMITS/);
    });
});
