import test from 'node:test';
import assert from 'node:assert/strict';
import {
  flowsForChangedPath,
  flowRunsForChangedFiles,
  mergeSmokeAndAffected,
  smokeFlowRuns,
  dedupeRuns,
} from '../lib/maestro-screen-flow-map.mjs';

test('flowsForChangedPath maps GroupsListScreen to layout flows', () => {
  const flows = flowsForChangedPath('cost-share-app/apps/mobile/screens/groups/GroupsListScreen.tsx');
  assert.ok(flows.includes('assert-groups-layout.yaml'));
  assert.ok(flows.includes('main-layout.yaml'));
});

test('flowsForChangedPath uses prefix fallback for group components', () => {
  const flows = flowsForChangedPath('cost-share-app/apps/mobile/components/groups/MonthlyBillsCycleSection.tsx');
  assert.deepEqual(flows, ['assert-groups-layout.yaml', 'main-layout.yaml']);
});

test('flowRunsForChangedFiles expands locales for login strings', () => {
  const runs = flowRunsForChangedFiles([
    'cost-share-app/apps/mobile/screens/auth/LoginScreen.tsx',
  ]);
  const localeRun = runs.find((r) => r.file === 'locale-strings-login.yaml');
  assert.ok(localeRun);
  assert.equal(localeRun.locales.length, 7);
});

test('mergeSmokeAndAffected dedupes overlapping flows', () => {
  const merged = mergeSmokeAndAffected(flowRunsForChangedFiles([
    'cost-share-app/apps/mobile/screens/groups/GroupsListScreen.tsx',
  ]));
  const signInCount = merged.filter((r) => r.file === 'sign-in.yaml').length;
  assert.equal(signInCount, 1);
  assert.ok(merged.length >= smokeFlowRuns().length);
});

test('dedupeRuns keeps distinct locale sets', () => {
  const runs = dedupeRuns([
    { file: 'main-layout.yaml', locales: ['en'] },
    { file: 'main-layout.yaml', locales: ['en', 'he'] },
  ]);
  assert.equal(runs.length, 2);
});
