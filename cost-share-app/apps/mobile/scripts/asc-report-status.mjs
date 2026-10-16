#!/usr/bin/env node
/** JSON status report for IAP + app version (for CI artifacts). */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ascConfig } from "./asc-api-common.mjs";
import { ascGetAll, ascRequest, getAscToken } from "./asc-api-client.mjs";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const meta = JSON.parse(fs.readFileSync(path.join(repoRoot, "store/asc/iap-metadata.json"), "utf8"));
const { appId } = ascConfig();
const token = getAscToken();

const subs = [];
for (const p of meta.products) {
  const sub = await ascRequest(`/v1/subscriptions/${p.ascId}`, { token });
  subs.push({
    productId: p.productId,
    ascId: p.ascId,
    state: sub.data.attributes?.state,
  });
}

const versions = await ascGetAll(
  `/v1/apps/${appId}/appStoreVersions?filter[platform]=IOS&limit=10`,
  token,
);
const version = versions.find((v) => v.attributes?.appStoreState === "PREPARE_FOR_SUBMISSION") ?? versions[0];

console.log(
  JSON.stringify(
    {
      subscriptions: subs,
      appStoreVersion: version
        ? {
            id: version.id,
            versionString: version.attributes?.versionString,
            appStoreState: version.attributes?.appStoreState,
          }
        : null,
    },
    null,
    2,
  ),
);
