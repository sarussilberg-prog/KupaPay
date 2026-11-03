import fs from 'fs';
import path from 'path';

const REPO_ROOT = path.resolve(__dirname, '../../../../..');

const DEV_STORE_WORKFLOWS = [
    { name: 'testflight-ios', file: '.github/workflows/testflight-ios.yml' },
    { name: 'play-internal', file: '.github/workflows/play-internal.yml' },
] as const;

const PRODUCTION_STORE_WORKFLOWS = [
    { name: 'app-store-production', file: '.github/workflows/app-store-production.yml' },
    { name: 'play-production', file: '.github/workflows/play-production.yml' },
] as const;

function workflowDispatchProEnabledDefault(yaml: string): string | null {
    const start = yaml.indexOf('workflow_dispatch:');
    if (start === -1) return null;
    const slice = yaml.slice(start);
    const end = slice.search(/\n  workflow_call:|\nconcurrency:/);
    const section = end === -1 ? slice : slice.slice(0, end);
    const match = section.match(/pro_enabled:[\s\S]*?default:\s*(true|false)/);
    return match?.[1] ?? null;
}

describe('Store release workflows — pro_enabled defaults', () => {
    it.each(DEV_STORE_WORKFLOWS)(
        '$name workflow_dispatch defaults pro_enabled to true (dev / TestFlight)',
        ({ file }) => {
            const yaml = fs.readFileSync(path.join(REPO_ROOT, file), 'utf8');
            expect(workflowDispatchProEnabledDefault(yaml)).toBe('true');
        },
    );

    it.each(PRODUCTION_STORE_WORKFLOWS)(
        '$name workflow_dispatch keeps pro_enabled false until Nave approves prod Pro',
        ({ file }) => {
            const yaml = fs.readFileSync(path.join(REPO_ROOT, file), 'utf8');
            expect(workflowDispatchProEnabledDefault(yaml)).toBe('false');
        },
    );
});
