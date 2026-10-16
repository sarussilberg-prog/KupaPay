#!/usr/bin/env node
/**
 * Align EAS remote iOS buildNumber with App Store Connect before a production build.
 *
 * With eas.json `appVersionSource: remote` and `production.autoIncrement: true`, the
 * next `eas build` uses (remote buildNumber + 1). We set remote to the latest VALID
 * ASC build so the IPA gets ASC + 1.
 */
import { ascConfig, createAscJwt, fetchAscBuilds } from "./asc-api-common.mjs";
import { getRemoteIosBuildNumber, setRemoteIosBuildNumber } from "./eas-remote-ios-build.mjs";

const { keyPath, keyId, issuerId, appId } = ascConfig();
const token = createAscJwt(keyPath, keyId, issuerId);

const builds = await fetchAscBuilds(appId, token, 20);
const valid = builds.filter((b) => b.attributes?.processingState === "VALID");
if (!valid.length) throw new Error("no_valid_builds_in_asc");

const ascLatest = Number(valid[0].attributes.version);
if (!Number.isFinite(ascLatest) || ascLatest < 0) {
  throw new Error(`invalid_asc_build_number: ${valid[0].attributes.version}`);
}

/** Remote value so autoIncrement yields this + 1 for the upcoming build. */
const remoteBaseline = ascLatest;
const expectedNextBuild = ascLatest + 1;

console.log(`Latest VALID ASC build: ${ascLatest} → expect IPA buildNumber ${expectedNextBuild} after autoIncrement`);

const currentRemote = await getRemoteIosBuildNumber();
const currentNum = currentRemote != null ? Number(currentRemote) : NaN;

if (Number.isFinite(currentNum) && currentNum >= remoteBaseline) {
  console.log(
    `EAS remote iOS buildNumber already ${currentRemote} (≥ ASC ${remoteBaseline}); skip set`,
  );
} else {
  const setTo = await setRemoteIosBuildNumber(String(remoteBaseline));
  console.log(`EAS remote iOS buildNumber set to ${setTo}`);
}

const after = await getRemoteIosBuildNumber();
if (after == null || Number(after) < remoteBaseline) {
  throw new Error(`eas_remote_build_sync_failed: got ${after}, need >= ${remoteBaseline}`);
}

console.log(`✅ EAS remote iOS buildNumber ${after} (next build → ${Number(after) + 1})`);
