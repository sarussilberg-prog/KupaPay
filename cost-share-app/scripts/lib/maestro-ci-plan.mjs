import { spawnSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import path from 'node:path';
import {
  fullFlowRuns,
  mergeSmokeAndAffected,
  flowRunsForChangedFiles,
} from './maestro-screen-flow-map.mjs';

/** Paths that force a native rebuild (not JS-only). */
const NATIVE_TOUCH_PATTERNS = [
  /^cost-share-app\/apps\/mobile\/ios\//,
  /^cost-share-app\/apps\/mobile\/android\//,
  /^cost-share-app\/apps\/mobile\/app\.json$/,
  /^cost-share-app\/apps\/mobile\/app\.config\./,
  /^cost-share-app\/apps\/mobile\/plugins\//,
  /^cost-share-app\/apps\/mobile\/modules\//,
  /^cost-share-app\/apps\/mobile\/package\.json$/,
  /^cost-share-app\/package-lock\.json$/,
  /^cost-share-app\/package\.json$/,
  /^cost-share-app\/apps\/mobile\/Podfile/,
  /^cost-share-app\/apps\/mobile\/.*\.podspec$/,
  /^cost-share-app\/apps\/mobile\/.*\.gradle/,
  /^cost-share-app\/apps\/mobile\/gradle\//,
  /^cost-share-app\/apps\/mobile\/eas\.json$/,
];

/**
 * @param {string[]} changedFiles
 * @returns {boolean}
 */
export function isJsOnlyMobileChange(changedFiles) {
  if (!changedFiles.length) return false;
  return changedFiles.every((file) => {
    const norm = file.replace(/\\/g, '/');
    if (
      !norm.startsWith('cost-share-app/apps/mobile/') &&
      !norm.startsWith('cost-share-app/packages/shared/')
    ) {
      return false;
    }
    return !NATIVE_TOUCH_PATTERNS.some((re) => re.test(norm));
  });
}

/**
 * @param {string} mobileAppDir absolute path to apps/mobile
 * @returns {string}
 */
function computeNativeFingerprint(mobileAppDir) {
  const result = spawnSync(
    'npx',
    ['--yes', '@expo/fingerprint', 'fingerprint:generate'],
    { cwd: mobileAppDir, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 },
  );
  if (result.status !== 0) {
    throw new Error(
      `expo fingerprint failed: ${result.stderr || result.stdout || result.status}`,
    );
  }
  const line = result.stdout.trim().split('\n').pop();
  const parsed = JSON.parse(line);
  if (!parsed.hash) {
    throw new Error('expo fingerprint JSON missing hash');
  }
  return parsed.hash;
}

/**
 * @param {{
 *   baseRef?: string,
 *   eventName?: string,
 *   prLabels?: string[],
 *   changedFiles?: string[],
 *   manualTier?: string | null,
 *   isPushMain?: boolean,
 *   workflowDispatchFull?: boolean,
 * }} input
 */
export function planMaestroCi(input) {
  const baseRef = (input.baseRef || 'dev').replace(/^refs\/heads\//, '');
  const labels = (input.prLabels || []).map((l) => l.toLowerCase());
  const changedFiles = input.changedFiles || [];

  let tier = 'smoke';
  if (
    baseRef === 'main' ||
    input.isPushMain ||
    input.workflowDispatchFull ||
    input.manualTier === 'full' ||
    labels.includes('maestro-full')
  ) {
    tier = 'full';
  }

  let flowRuns;
  if (tier === 'full') {
    flowRuns = fullFlowRuns();
  } else {
    const affected = flowRunsForChangedFiles(changedFiles);
    flowRuns = mergeSmokeAndAffected(affected);
  }

  const jsOnly = isJsOnlyMobileChange(changedFiles);
  const runAndroid = tier === 'full';
  const runIos = true;

  return {
    tier,
    runIos,
    runAndroid,
    jsOnly,
    flowRuns,
  };
}

/**
 * CLI: write GitHub Actions outputs and summary JSON to stdout.
 */
function runMaestroCiPlanCli() {
  const repoRoot = process.env.GITHUB_WORKSPACE || path.resolve(import.meta.dirname, '../../..');
  const mobileDir = path.join(repoRoot, 'cost-share-app/apps/mobile');

  const changedRaw = process.env.CHANGED_FILES || '';
  const changedFiles = changedRaw
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

  const plan = planMaestroCi({
    baseRef: process.env.GITHUB_BASE_REF || 'dev',
    eventName: process.env.GITHUB_EVENT_NAME,
    prLabels: (process.env.PR_LABELS || '').split(',').filter(Boolean),
    changedFiles,
    manualTier: process.env.MAESTRO_MANUAL_TIER || null,
    isPushMain: process.env.GITHUB_REF === 'refs/heads/main',
    workflowDispatchFull: process.env.MAESTRO_WORKFLOW_DISPATCH_FULL === 'true',
  });

  const nativeFingerprint = computeNativeFingerprint(mobileDir);

  const payload = {
    ...plan,
    nativeFingerprint,
    skipNativeRebuild: plan.jsOnly,
  };

  process.stdout.write(`${JSON.stringify(payload)}\n`);

  if (process.env.GITHUB_OUTPUT) {
    const out = process.env.GITHUB_OUTPUT;
    appendFileSync(out, `tier=${plan.tier}\n`, 'utf8');
    appendFileSync(out, `run_ios=${plan.runIos}\n`, 'utf8');
    appendFileSync(out, `run_android=${plan.runAndroid}\n`, 'utf8');
    appendFileSync(out, `js_only=${plan.jsOnly}\n`, 'utf8');
    appendFileSync(out, `skip_native_rebuild=${plan.jsOnly}\n`, 'utf8');
    appendFileSync(out, `native_fingerprint=${nativeFingerprint}\n`, 'utf8');
    appendFileSync(out, `flow_plan_json=${JSON.stringify(plan.flowRuns)}\n`, 'utf8');
  }
}

const isDirectRun =
  process.argv[1] &&
  (process.argv[1].endsWith('maestro-ci-plan.mjs') ||
    process.argv[1].endsWith('maestro-ci-plan'));
if (isDirectRun) {
  try {
    runMaestroCiPlanCli();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
