/**
 * Shared App Store Connect API helpers for CI scripts.
 */
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const mobileDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

export function ascConfig() {
  const keyPath = process.env.ASC_API_KEY_PATH ?? path.join(mobileDir, "asc-api-key.p8");
  const keyId = process.env.ASC_API_KEY_ID;
  const issuerId = process.env.ASC_API_KEY_ISSUER_ID;
  const appId = process.env.ASC_APP_ID ?? "6780216665";
  if (!keyId || !issuerId) {
    throw new Error("ASC_API_KEY_ID and ASC_API_KEY_ISSUER_ID are required");
  }
  return { keyPath, keyId, issuerId, appId };
}

export function createAscJwt(keyPath, keyId, issuerId) {
  const key = fs.readFileSync(keyPath, "utf8");
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "ES256", kid: keyId, typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({ iss: issuerId, iat: now, exp: now + 1200, aud: "appstoreconnect-v1" })
  ).toString("base64url");
  const sig = crypto.sign("sha256", Buffer.from(`${header}.${payload}`), { key, dsaEncoding: "ieee-p1363" });
  return `${header}.${payload}.${sig.toString("base64url")}`;
}

export async function fetchAscBuilds(appId, token, limit = 20) {
  const url = `https://api.appstoreconnect.apple.com/v1/builds?filter[app]=${appId}&sort=-uploadedDate&limit=${limit}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const json = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(json));
  return json.data ?? [];
}
