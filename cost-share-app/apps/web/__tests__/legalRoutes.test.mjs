import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Issue #222: public legal pages on Next.js (`/terms`, `/privacy` + `?lang=`). */
test('terms and privacy app routes are present', () => {
    assert.ok(existsSync(join(appRoot, 'app/terms/page.tsx')));
    assert.ok(existsSync(join(appRoot, 'app/privacy/page.tsx')));
    assert.ok(existsSync(join(appRoot, 'app/_components/LegalPage.tsx')));
});
