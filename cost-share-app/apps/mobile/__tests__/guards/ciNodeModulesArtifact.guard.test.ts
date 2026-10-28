import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const REPO_ROOT = resolve(__dirname, '../../../../..');
const CI_YML = readFileSync(resolve(REPO_ROOT, '.github/workflows/ci.yml'), 'utf8');

describe('CI node_modules artifact (issue #624)', () => {
  it('does not fall back to npm ci when install artifact bins are missing', () => {
    expect(CI_YML).not.toMatch(/test -x node_modules\/\.bin\/\S+ \|\| npm ci/);
    expect(CI_YML).toContain('ci-pack-node-modules-artifact.sh');
    expect(CI_YML).toContain('ci-restore-node-modules-from-artifact.sh');
    expect(CI_YML).toContain('ci-assert-install-artifact.sh');
    expect(CI_YML).toContain('node_modules.tar.zst');
  });
});
