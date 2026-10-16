import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const policyPath = join(root, 'packages/shared/src/security/contentSecurityPolicy.ts');
const nextConfigPath = join(root, 'apps/web/next.config.ts');

test('next.config uses enforcing Content-Security-Policy header', () => {
    const nextConfig = readFileSync(nextConfigPath, 'utf8');
    assert.match(nextConfig, /key:\s*'Content-Security-Policy'/);
    assert.doesNotMatch(nextConfig, /Content-Security-Policy-Report-Only/);
    assert.match(nextConfig, /CONTENT_SECURITY_POLICY/);
});

test('shared CSP module is the single source of truth', () => {
    const source = readFileSync(policyPath, 'utf8');
    assert.match(source, /export const CONTENT_SECURITY_POLICY/);
    assert.match(source, /wss:/);
});
