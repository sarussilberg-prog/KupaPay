import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parsePrSections,
  validatePrStructure,
  isTestFile,
  isBugFixPr,
  extractListedTestFiles,
  isDependabotExempt,
} from '../lib/pr-structure-gate.mjs';

const FULL_BODY = `
## Implementation

We added a PR structure gate that validates the PR template, test file claims against the diff,
spec documentation updates, and red/green proof for bug-fix pull requests.

## Tests

- \`cost-share-app/scripts/__tests__/pr-structure-gate.test.mjs\` — unit tests for the validator.

## Proof

The unit tests assert that a PR body missing any required section fails validation, and that listed
test paths must appear in the diff.

## Spec

Updated \`docs/TESTING.md\` with PR gate rules and spec doc paths.

Spec: no change needed - covered by TESTING.md edit in this PR.
`.trim();

test('parsePrSections extracts four required headings', () => {
  const s = parsePrSections(FULL_BODY);
  assert.ok(s.Implementation?.length > 20);
  assert.ok(s.Tests?.includes('pr-structure-gate.test.mjs'));
  assert.ok(s.Proof?.includes('missing'));
  assert.ok(s.Spec?.includes('TESTING'));
});

test('isTestFile recognizes common test paths', () => {
  assert.equal(isTestFile('cost-share-app/apps/mobile/__tests__/foo.test.ts'), true);
  assert.equal(isTestFile('cost-share-app/scripts/__tests__/bar.test.mjs'), true);
  assert.equal(isTestFile('cost-share-app/apps/mobile/lib/x.ts'), false);
});

test('missing Implementation section fails validation', () => {
  const body = FULL_BODY.replace(/## Implementation[\s\S]*?(?=## Tests)/, '');
  const result = validatePrStructure({
    body,
    title: 'feat: gate',
    labels: [],
    authorLogin: 'human',
    changedFiles: [
      'cost-share-app/scripts/lib/pr-structure-gate.mjs',
      'cost-share-app/scripts/__tests__/pr-structure-gate.test.mjs',
      'docs/TESTING.md',
    ],
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes('Implementation')));
});

test('app code without tests fails unless no-tests-needed', () => {
  const result = validatePrStructure({
    body: FULL_BODY,
    title: 'feat: x',
    labels: [],
    authorLogin: 'human',
    changedFiles: ['cost-share-app/apps/mobile/lib/x.ts'],
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes('without test file')));
});

test('no-tests-needed requires justification line', () => {
  const result = validatePrStructure({
    body: FULL_BODY,
    title: 'chore: deps',
    labels: ['no-tests-needed'],
    authorLogin: 'human',
    changedFiles: ['cost-share-app/apps/mobile/lib/x.ts'],
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes('No tests needed:')));
});

test('listed test not in diff fails', () => {
  const body = FULL_BODY.replace(
    'cost-share-app/scripts/__tests__/pr-structure-gate.test.mjs',
    'cost-share-app/scripts/__tests__/phantom.test.mjs',
  );
  const result = validatePrStructure({
    body,
    title: 'feat: gate',
    labels: [],
    authorLogin: 'human',
    changedFiles: ['cost-share-app/scripts/__tests__/pr-structure-gate.test.mjs', 'docs/TESTING.md'],
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes('not changed')));
});

test('spec requires doc touch or Spec: no change needed line', () => {
  const body = FULL_BODY.replace(/Spec: no change needed.+/m, '');
  const result = validatePrStructure({
    body,
    title: 'feat: gate',
    labels: [],
    authorLogin: 'human',
    changedFiles: ['cost-share-app/scripts/__tests__/pr-structure-gate.test.mjs'],
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes('Spec section')));
});

test('valid PR with matching tests and spec doc passes', () => {
  const result = validatePrStructure({
    body: FULL_BODY,
    title: 'feat(ci): pr structure gate',
    labels: [],
    authorLogin: 'human',
    changedFiles: [
      'cost-share-app/scripts/lib/pr-structure-gate.mjs',
      'cost-share-app/scripts/__tests__/pr-structure-gate.test.mjs',
      'docs/TESTING.md',
      '.github/workflows/ci.yml',
    ],
  });
  assert.equal(result.ok, true, result.errors.join('; '));
});

test('isBugFixPr detects label and conventional title', () => {
  assert.equal(isBugFixPr('feat: x', ['bug']), true);
  assert.equal(isBugFixPr('fix(mobile): crash', []), true);
  assert.equal(isBugFixPr('feat: x', []), false);
});

test('dependabot lockfile-only exemption', () => {
  assert.equal(
    isDependabotExempt('dependabot[bot]', ['cost-share-app/package-lock.json']),
    true,
  );
  assert.equal(
    isDependabotExempt('dependabot[bot]', ['cost-share-app/apps/mobile/foo.ts']),
    false,
  );
});

test('extractListedTestFiles finds backtick paths', () => {
  const listed = extractListedTestFiles(
    '- `cost-share-app/scripts/__tests__/pr-structure-gate.test.mjs`',
  );
  assert.deepEqual(listed, ['cost-share-app/scripts/__tests__/pr-structure-gate.test.mjs']);
});
