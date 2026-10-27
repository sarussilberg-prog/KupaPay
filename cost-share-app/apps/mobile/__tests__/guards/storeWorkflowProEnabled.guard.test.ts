import fs from 'fs';
import path from 'path';

const REPO_ROOT = path.resolve(__dirname, '../../../../..');

const STORE_WORKFLOWS = [
    { name: 'testflight-ios', file: '.github/workflows/testflight-ios.yml' },
    { name: 'play-internal', file: '.github/workflows/play-internal.yml' },
] as const;

/** Pro must default off for manual store releases (workflow_dispatch). */
function workflowDispatchProEnabledDefault(yaml: string): string | null {
    const start = yaml.indexOf('workflow_dispatch:');
    if (start === -1) return null;
    const slice = yaml.slice(start);
    const end = slice.search(/\n  workflow_call:|\nconcurrency:/);
    const section = end === -1 ? slice : slice.slice(0, end);
    const match = section.match(/pro_enabled:[\s\S]*?default:\s*(true|false)/);
    return match?.[1] ?? null;
}

describe('Store release workflows — pro_enabled default off for manual runs', () => {
    it.each(STORE_WORKFLOWS)('$name workflow_dispatch defaults pro_enabled to false', ({ file }) => {
        const yaml = fs.readFileSync(path.join(REPO_ROOT, file), 'utf8');
        expect(workflowDispatchProEnabledDefault(yaml)).toBe('false');
    });
});
