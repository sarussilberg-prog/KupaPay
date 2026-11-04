/**
 * Maps mobile screen/component source paths to Maestro device-ui flows.
 * Documented in docs/TESTING.md § Maestro CI tiers.
 */

/** @typedef {{ file: string, locales: string[] | null, note?: string }} FlowRun */

const MOBILE_PREFIX = 'cost-share-app/apps/mobile/';

/** @param {string} p */
function normalizeMobilePath(p) {
  const norm = p.replace(/\\/g, '/');
  if (norm.startsWith(MOBILE_PREFIX)) {
    return norm.slice(MOBILE_PREFIX.length);
  }
  if (norm.startsWith('apps/mobile/')) {
    return norm.slice('apps/mobile/'.length);
  }
  return norm;
}

/** Screen or feature roots → flow basenames (under device-ui). Keys are under apps/mobile/. */
const SCREEN_TO_FLOWS = Object.freeze({
  'screens/auth/LoginScreen.tsx': [
    'sign-in.yaml',
    'locale-strings-login.yaml',
    'assert-layout-probes.yaml',
  ],
  'components/auth/LoginE2EPasswordAuth.tsx': [
    'sign-in.yaml',
    'locale-strings-login.yaml',
  ],
  'screens/groups/GroupsListScreen.tsx': [
    'assert-layout-probes.yaml',
    'assert-groups-layout.yaml',
    'groups-layout-diagnostics-tour.yaml',
    'main-layout.yaml',
  ],
  'components/groups/GroupsListHeader.tsx': [
    'assert-groups-layout.yaml',
    'groups-layout-diagnostics-tour.yaml',
    'main-layout.yaml',
  ],
  'components/GroupCard.tsx': [
    'assert-groups-layout.yaml',
    'assert-layout-probes.yaml',
    'groups-layout-diagnostics-tour.yaml',
  ],
  'lib/groupsLayoutDiagnostics.ts': ['groups-layout-diagnostics-tour.yaml'],
  'components/diagnostics/GroupsLayoutDiagnosticsReporter.tsx': [
    'groups-layout-diagnostics-tour.yaml',
  ],
  'components/diagnostics/layoutProbeHandlers.ts': ['groups-layout-diagnostics-tour.yaml'],
  'components/groups/CreateGroupFloatingButton.tsx': [
    'assert-layout-probes.yaml',
    'assert-groups-layout.yaml',
  ],
  'screens/activity/ActivityFeedScreen.tsx': ['visit-main-screens.yaml', 'main-layout.yaml'],
  'screens/favoriteGroup/FavoriteGroupScreen.tsx': ['visit-main-screens.yaml', 'main-layout.yaml'],
  'screens/expenses/AddExpenseScreen.tsx': ['visit-main-screens.yaml', 'main-layout.yaml'],
  'screens/profile/ProfileScreen.tsx': [
    'visit-main-screens.yaml',
    'main-layout.yaml',
    'profile-friend-breakdown.yaml',
  ],
  'components/dashboard/FriendGroupBalancesSheet.tsx': ['profile-friend-breakdown.yaml'],
  'components/dashboard/FriendCrossGroupSettleSheet.tsx': ['profile-friend-breakdown.yaml'],
  'components/navigation/CustomTabBar.tsx': [
    'visit-main-screens.yaml',
    'main-layout.yaml',
    'groups-layout-diagnostics-tour.yaml',
    'rtl-main-screens-tour-en.yaml',
    'rtl-main-screens-tour-he.yaml',
  ],
  'hooks/useRtlLayout.tsx': [
    'main-layout.yaml',
    'profile-friend-breakdown.yaml',
    'rtl-main-screens-tour-en.yaml',
    'rtl-main-screens-tour-he.yaml',
  ],
  'screens/profile/SettingsScreen.tsx': ['visit-main-screens.yaml', 'main-layout.yaml'],
});

/** Prefix fallbacks when a directory changes but no exact screen key matches. */
const PREFIX_TO_FLOWS = Object.freeze([
  { prefix: 'screens/groups/', flows: ['assert-groups-layout.yaml', 'main-layout.yaml'] },
  { prefix: 'screens/expenses/', flows: ['visit-main-screens.yaml', 'main-layout.yaml'] },
  { prefix: 'screens/profile/', flows: ['main-layout.yaml', 'profile-friend-breakdown.yaml'] },
  { prefix: 'screens/activity/', flows: ['visit-main-screens.yaml', 'main-layout.yaml'] },
  { prefix: 'screens/auth/', flows: ['sign-in.yaml', 'locale-strings-login.yaml'] },
  {
    prefix: 'components/groups/',
    flows: ['assert-groups-layout.yaml', 'groups-layout-diagnostics-tour.yaml', 'main-layout.yaml'],
  },
  { prefix: 'components/diagnostics/', flows: ['groups-layout-diagnostics-tour.yaml'] },
  { prefix: 'components/dashboard/', flows: ['profile-friend-breakdown.yaml', 'main-layout.yaml'] },
]);

const FULL_LOCALE_STRINGS = Object.freeze(['en', 'he', 'ar', 'ru', 'de', 'es', 'fr']);
const LAYOUT_LOCALES = Object.freeze(['en', 'he']);

/** @returns {FlowRun[]} */
export function smokeFlowRuns() {
  return [
    { file: 'sign-in.yaml', locales: null },
    { file: 'assert-layout-probes.yaml', locales: null },
    { file: 'visit-main-screens.yaml', locales: ['en'] },
  ];
}

/** @returns {FlowRun[]} */
export function fullFlowRuns() {
  const runs = [
    { file: 'sign-in.yaml', locales: null },
    { file: 'assert-layout-probes.yaml', locales: null },
    { file: 'locale-strings-login.yaml', locales: [...FULL_LOCALE_STRINGS] },
    { file: 'main-layout.yaml', locales: [...LAYOUT_LOCALES] },
    { file: 'profile-friend-breakdown.yaml', locales: ['he'] },
  ];
  return runs;
}

/**
 * @param {string} repoRelativePath path from repo root, forward slashes
 * @returns {string[]}
 */
export function flowsForChangedPath(repoRelativePath) {
  const norm = normalizeMobilePath(repoRelativePath);
  if (SCREEN_TO_FLOWS[norm]) {
    return [...SCREEN_TO_FLOWS[norm]];
  }
  for (const { prefix, flows } of PREFIX_TO_FLOWS) {
    if (norm.startsWith(prefix)) {
      return [...flows];
    }
  }
  if (norm.startsWith('.maestro/device-ui/')) {
    const base = norm.split('/').pop();
    return base ? [base] : [];
  }
  return [];
}

/**
 * @param {string[]} changedFiles repo-root paths
 * @returns {FlowRun[]}
 */
export function flowRunsForChangedFiles(changedFiles) {
  /** @type {Set<string>} */
  const flowNames = new Set();
  for (const file of changedFiles) {
    for (const flow of flowsForChangedPath(file)) {
      flowNames.add(flow);
    }
  }
  if (flowNames.size === 0) {
    return [];
  }
  return expandFlowNamesToRuns([...flowNames].sort());
}

/**
 * @param {string[]} flowNames basenames only
 * @returns {FlowRun[]}
 */
function expandFlowNamesToRuns(flowNames) {
  /** @type {FlowRun[]} */
  const runs = [];
  for (const file of flowNames) {
    if (file === 'locale-strings-login.yaml') {
      runs.push({ file, locales: [...FULL_LOCALE_STRINGS] });
    } else if (
      file === 'main-layout.yaml' ||
      file === 'assert-groups-layout.yaml' ||
      file === 'groups-layout-diagnostics-tour.yaml'
    ) {
      runs.push({ file, locales: [...LAYOUT_LOCALES] });
    } else if (file === 'profile-friend-breakdown.yaml') {
      runs.push({ file, locales: ['he'] });
    } else if (file === 'visit-main-screens.yaml') {
      runs.push({ file, locales: ['en', 'he'] });
    } else if (file === 'rtl-main-screens-tour-en.yaml') {
      runs.push({ file, locales: ['en'] });
    } else if (file === 'rtl-main-screens-tour-he.yaml') {
      runs.push({ file, locales: ['he'] });
    } else {
      runs.push({ file, locales: null });
    }
  }
  return dedupeRuns(runs);
}

/** @param {FlowRun[]} runs */
export function dedupeRuns(runs) {
  const seen = new Set();
  /** @type {FlowRun[]} */
  const out = [];
  for (const run of runs) {
    const key = `${run.file}::${run.locales?.join(',') ?? '*'}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(run);
  }
  return out;
}

/**
 * Merge smoke + affected flows for dev PR tier.
 * @param {FlowRun[]} affected
 * @returns {FlowRun[]}
 */
export function mergeSmokeAndAffected(affected) {
  return dedupeRuns([...smokeFlowRuns(), ...affected]);
}


