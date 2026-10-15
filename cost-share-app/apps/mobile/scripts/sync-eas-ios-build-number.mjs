#!/usr/bin/env node
/**
 * Set EAS remote iOS buildNumber to match latest VALID build in App Store Connect.
 * Prevents counter drift (EAS ahead/behind ASC). Does not change marketing version.
 */
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ascConfig, createAscJwt, fetchAscBuilds } from "./asc-api-common.mjs";

const mobileDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const { keyPath, keyId, issuerId, appId } = ascConfig();
const token = createAscJwt(keyPath, keyId, issuerId);

const builds = await fetchAscBuilds(appId, token, 20);
const valid = builds.filter((b) => b.attributes?.processingState === "VALID");
if (!valid.length) throw new Error("no_valid_builds_in_asc");
const ascBuild = Number(valid[0].attributes.version);

console.log(`Latest VALID ASC build: ${ascBuild}`);
execSync(`yes | eas build:version:set -p ios ${ascBuild}`, {
  cwd: mobileDir,
  stdio: "inherit",
  shell: "/bin/bash",
  env: { ...process.env, CI: "1" },
});
console.log(`EAS iOS buildNumber synced to ${ascBuild}`);
