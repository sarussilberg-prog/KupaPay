/**
 * Guards Release Health config (#427) for the Next.js site.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

test('sentryInit documents auto session tracking for crash-free rate', () => {
    const source = readFileSync(join(appRoot, 'lib/sentryInit.ts'), 'utf8');
    assert.match(source, /Release Health \(#427\)/);
    assert.match(source, /release,/);
});
