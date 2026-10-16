/**
 * App Store Connect API client (JWT + JSON:API helpers).
 */
import fs from "node:fs";
import { ascConfig, createAscJwt } from "./asc-api-common.mjs";

const BASE = "https://api.appstoreconnect.apple.com";

export function getAscToken() {
  const { keyPath, keyId, issuerId } = ascConfig();
  return createAscJwt(keyPath, keyId, issuerId);
}

export async function ascRequest(path, { method = "GET", body, token } = {}) {
  const jwt = token ?? getAscToken();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(`ASC ${method} ${path} → ${res.status}`);
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}

export async function ascGetAll(firstPath, token) {
  const items = [];
  let path = firstPath;
  while (path) {
    const json = await ascRequest(path, { token });
    if (Array.isArray(json.data)) items.push(...json.data);
    else if (json.data) items.push(json.data);
    const next = json.links?.next;
    path = next ? next.replace(BASE, "") : null;
  }
  return items;
}

/** Upload binary to ASC reservation (subscription / app screenshot). */
export async function ascUploadBinary(uploadOperations, filePath) {
  const bytes = fs.readFileSync(filePath);
  const op = uploadOperations?.[0];
  if (!op?.url) throw new Error("asc_upload_missing_operation");
  const headers = {};
  for (const h of op.requestHeaders ?? []) {
    headers[h.name] = h.value;
  }
  const res = await fetch(op.url, { method: op.method ?? "PUT", headers, body: bytes });
  if (!res.ok) {
    throw new Error(`asc_upload_failed: ${res.status} ${await res.text()}`);
  }
}
