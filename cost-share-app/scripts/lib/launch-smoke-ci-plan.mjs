import { appendFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { NATIVE_TOUCH_PATTERNS, planMaestroCi } from './maestro-ci-plan.mjs';

/** Boot entrypoints — launch smoke on dev when these change (with native paths). */
export const LAUNCH_SMOKE_BOOT_PATTERNS = [
  /^cost-share-app\/apps\/mobile\/index\.ts$/,
  /^cost-share-app\/apps\/mobile\/App\.tsx$/,
  /^cost-share-app\/apps\/mobile\/app\/_layout\.tsx$/,
];

/** @param {string} file */
function norm(file) {
  return file.replace(/\\/g, '/');
}

/**
 * @param {string[]} changedFiles
 * @returns {boolean}
 */
export function touchesLaunchSmokeNativeOrBoot(changedFiles) {
  return changedFiles.some((file) => {
    const n = norm(file);
    if (LAUNCH_SMOKE_BOOT_PATTERNS.some((re) => re.test(n))) return true;
    return NATIVE_TOUCH_PATTERNS.some((re) => re.test(n));
  });
}

/**
 * @param {{
 *   baseRef?: string,
 *   changedFiles?: string[],
 *   isPushMain?: boolean,
 *   tier?: string,
 * }} input
 * @returns {{ runLaunchSmoke: boolean, tier: string, runAndroid: boolean }}
 */
export function planReleaseLaunchSmoke(input) {
  const changedFiles = input.changedFiles || [];
  const baseRef = (input.baseRef || 'dev').replace(/^refs\/heads\//, '');
  const maestro = planMaestroCi({
    baseRef,
    changedFiles,
    isPushMain: input.isPushMain,
    workflowDispatchFull: input.tier === 'full',
    manualTier: input.tier,
  });
  const tier = input.tier || maestro.tier;

  let runLaunchSmoke = false;
  if (input.isPushMain || baseRef === 'main' || tier === 'full') {
    runLaunchSmoke = true;
  } else if (touchesLaunchSmokeNativeOrBoot(changedFiles)) {
    runLaunchSmoke = true;
  }

  return {
    runLaunchSmoke,
    tier,
    runAndroid: maestro.runAndroid,
    runIos: maestro.runIos,
  };
}

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

function runLaunchSmokeCiPlanCli() {
  const repoRoot = process.env.GITHUB_WORKSPACE || path.resolve(import.meta.dirname, '../../..');
  const mobileDir = path.join(repoRoot, 'cost-share-app/apps/mobile');

  const changedRaw = process.env.CHANGED_FILES || '';
  const changedFiles = changedRaw
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

  const plan = planReleaseLaunchSmoke({
    baseRef: process.env.GITHUB_BASE_REF || 'dev',
    changedFiles,
    isPushMain: process.env.GITHUB_REF === 'refs/heads/main',
    tier: process.env.MAESTRO_MANUAL_TIER || undefined,
  });

  const nativeFingerprint = computeNativeFingerprint(mobileDir);
  const payload = { ...plan, nativeFingerprint };
  process.stdout.write(`${JSON.stringify(payload)}\n`);

  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `run_launch_smoke=${plan.runLaunchSmoke}\n`, 'utf8');
    appendFileSync(process.env.GITHUB_OUTPUT, `native_fingerprint=${nativeFingerprint}\n`, 'utf8');
  }
}

const isDirectRun =
  process.argv[1] &&
  (process.argv[1].endsWith('launch-smoke-ci-plan.mjs') ||
    process.argv[1].endsWith('launch-smoke-ci-plan'));
if (isDirectRun) {
  try {
    runLaunchSmokeCiPlanCli();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
