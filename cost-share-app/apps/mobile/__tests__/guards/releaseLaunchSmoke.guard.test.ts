import { spawnSync } from 'node:child_process';
import path from 'node:path';

const SCRIPT = path.join(__dirname, '../../scripts/ci-release-launch-smoke.sh');

describe('Release launch smoke script (Phase 4)', () => {
    it('self-test passes without inject flag', () => {
        const result = spawnSync('bash', [SCRIPT, 'self-test'], { encoding: 'utf8' });
        expect(result.status).toBe(0);
        expect(result.stdout + result.stderr).toMatch(/self-test OK/i);
    });

    it('self-test fails with RELEASE_LAUNCH_SMOKE_INJECT_CRASH=1 (red/green proof)', () => {
        const result = spawnSync('bash', [SCRIPT, 'ios', 'self-test'], {
            encoding: 'utf8',
            env: { ...process.env, RELEASE_LAUNCH_SMOKE_INJECT_CRASH: '1' },
        });
        expect(result.status).not.toBe(0);
        expect(result.stdout + result.stderr).toMatch(/INJECT_CRASH|simulated startup crash/i);
    });
});
