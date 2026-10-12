#!/usr/bin/env node
/**
 * Set EAS remote iOS buildNumber to match latest VALID build in App Store Connect.
 * Prevents counter drift (EAS ahead/behind ASC). Does not change marketing version.
 */
import { execSync } from "child_process";
import fs from "fs";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mobileDir = path.join(__dirname, "..");

const keyPath = process.env.ASC_API_KEY_PATH ?? path.join(mobileDir, "asc-api-key.p8");
const keyId = process.env.ASC_API_KEY_ID;
const issuerId = process.env.ASC_API_KEY_ISSUER_ID;
const appId = process.env.ASC_APP_ID ?? "6780216665";

if (!keyId || !issuerId) {
  console.error("ASC_API_KEY_ID and ASC_API_KEY_ISSUER_ID are required");
  process.exit(1);
}

function jwt() {
  const key = fs.readFileSync(keyPath, "utf8");
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "ES256", kid: keyId, typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({ iss: issuerId, iat: now, exp: now + 1200, aud: "appstoreconnect-v1" })
  ).toString("base64url");
  const sig = crypto.sign("sha256", Buffer.from(`${header}.${payload}`), { key, dsaEncoding: "ieee-p1363" });
  return `${header}.${payload}.${sig.toString("base64url")}`;
}

async function latestValidBuild() {
  const url = `https://api.appstoreconnect.apple.com/v1/builds?filter[app]=${appId}&sort=-uploadedDate&limit=20`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${jwt()}` } });
  const json = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(json));
  const valid = (json.data ?? []).filter((b) => b.attributes?.processingState === "VALID");
  if (!valid.length) throw new Error("no_valid_builds_in_asc");
  return Number(valid[0].attributes.version);
}

const ascBuild = await latestValidBuild();
console.log(`Latest VALID ASC build: ${ascBuild}`);
execSync(`yes | npx eas-cli build:version:set -p ios ${ascBuild}`, {
  cwd: mobileDir,
  stdio: "inherit",
  shell: "/bin/bash",
  env: { ...process.env, CI: "1" },
});
console.log(`EAS iOS buildNumber synced to ${ascBuild}`);
