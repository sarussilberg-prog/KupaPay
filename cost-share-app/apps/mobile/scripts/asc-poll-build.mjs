#!/usr/bin/env node
/**
 * Poll App Store Connect until a build >= minVersion appears (or timeout).
 * Usage: node scripts/asc-poll-build.mjs [minBuildNumber]
 */
import { ascConfig, createAscJwt, fetchAscBuilds } from "./asc-api-common.mjs";

const { keyPath, keyId, issuerId, appId } = ascConfig();
const token = createAscJwt(keyPath, keyId, issuerId);
const minBuild = Math.max(1, Math.floor(Number(process.argv[2] ?? process.env.MIN_BUILD ?? "1")));
const maxWaitMs = Number(process.env.ASC_POLL_MAX_MS ?? 600_000);
const intervalMs = Number(process.env.ASC_POLL_INTERVAL_MS ?? 30_000);

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function pollOnce(elapsedSec) {
  const builds = await fetchAscBuilds(appId, token, 5);
  const hit = builds.find((b) => Number(b.attributes?.version) >= minBuild);
  if (hit) {
    const { version, processingState, uploadedDate } = hit.attributes ?? {};
    console.log(`ASC build ${String(version)} ${String(processingState)} (${String(uploadedDate)})`);
    if (processingState === "VALID" || processingState === "PROCESSING") {
      return true;
    }
  }
  console.log(`Waiting for build >= ${minBuild}... (${elapsedSec}s)`);
  return false;
}

const start = Date.now();
let done = false;
while (Date.now() - start < maxWaitMs) {
  const elapsedSec = Math.round((Date.now() - start) / 1000);
  done = await pollOnce(elapsedSec);
  if (done) process.exit(0);
  await sleep(intervalMs);
}

console.error(`Timeout: no ASC build >= ${minBuild} after ${maxWaitMs}ms`);
process.exit(1);
