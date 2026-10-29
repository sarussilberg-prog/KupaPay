#!/usr/bin/env node
/**
 * Create/prepare App Store version, attach latest VALID build, fill What's New.
 * Never submits for review.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ascConfig, createAscJwt, fetchAscBuilds } from "./asc-api-common.mjs";
import { ascGetAll, ascRequest, getAscToken } from "./asc-api-client.mjs";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const whatsNew = JSON.parse(fs.readFileSync(path.join(repoRoot, "store/asc/whats-new.json"), "utf8"));
const { appId } = ascConfig();
const token = getAscToken();
const dryRun = process.argv.includes("--dry-run");

async function listIosVersions() {
  return ascGetAll(`/v1/apps/${appId}/appStoreVersions?filter[platform]=IOS&limit=30`, token);
}

async function createVersion(versionString) {
  if (dryRun) return { id: "dry-run", attributes: { versionString, appStoreState: "PREPARE_FOR_SUBMISSION" } };
  const res = await ascRequest("/v1/appStoreVersions", {
    method: "POST",
    token,
    body: {
      data: {
        type: "appStoreVersions",
        attributes: { platform: "IOS", versionString },
        relationships: { app: { data: { type: "apps", id: appId } } },
      },
    },
  });
  return res.data;
}

async function upsertWhatsNew(versionId, locale, text) {
  const locs = await ascGetAll(
    `/v1/appStoreVersions/${versionId}/appStoreVersionLocalizations?limit=50`,
    token,
  );
  const hit = locs.find((l) => l.attributes?.locale === locale);
  if (hit) {
    if (dryRun) return;
    await ascRequest(`/v1/appStoreVersionLocalizations/${hit.id}`, {
      method: "PATCH",
      token,
      body: {
        data: {
          type: "appStoreVersionLocalizations",
          id: hit.id,
          attributes: { whatsNew: text },
        },
      },
    });
    return;
  }
  if (dryRun) return;
  await ascRequest("/v1/appStoreVersionLocalizations", {
    method: "POST",
    token,
    body: {
      data: {
        type: "appStoreVersionLocalizations",
        attributes: { locale, whatsNew: text },
        relationships: {
          appStoreVersion: { data: { type: "appStoreVersions", id: versionId } },
        },
      },
    },
  });
}

async function attachLatestValidBuild(versionId) {
  const jwt = createAscJwt(ascConfig().keyPath, ascConfig().keyId, ascConfig().issuerId);
  const builds = await fetchAscBuilds(appId, jwt, 15);
  const valid = builds.filter((b) => b.attributes?.processingState === "VALID");
  if (!valid.length) throw new Error("no_valid_build_for_version");
  const buildId = valid[0].id;
  if (dryRun) {
    console.log(`[dry-run] attach build ${buildId}`);
    return buildId;
  }
  await ascRequest(`/v1/appStoreVersions/${versionId}`, {
    method: "PATCH",
    token,
    body: {
      data: {
        type: "appStoreVersions",
        id: versionId,
        relationships: { build: { data: { type: "builds", id: buildId } } },
      },
    },
  });
  return buildId;
}

async function main() {
  const versions = await listIosVersions();
  let version = versions.find((v) => v.attributes?.versionString === whatsNew.versionString);
  if (!version) {
    // ASC allows one editable version: reuse it (rename) instead of creating a second one.
    const editable = versions.find((v) => v.attributes?.appStoreState === "PREPARE_FOR_SUBMISSION");
    if (editable && !dryRun) {
      console.log(`Renaming editable version ${editable.attributes?.versionString} → ${whatsNew.versionString}`);
      const patched = await ascRequest(`/v1/appStoreVersions/${editable.id}`, {
        method: "PATCH",
        token,
        body: {
          data: {
            type: "appStoreVersions",
            id: editable.id,
            attributes: { versionString: whatsNew.versionString },
          },
        },
      });
      version = patched.data;
    } else {
      version = await createVersion(whatsNew.versionString);
    }
  }

  const versionId = version.id;
  for (const [locale, text] of Object.entries(whatsNew.locales)) {
    await upsertWhatsNew(versionId, locale, text);
  }
  const buildId = await attachLatestValidBuild(versionId);
  const refreshed = await ascRequest(`/v1/appStoreVersions/${versionId}`, { token });

  console.log(
    JSON.stringify(
      {
        ok: true,
        versionId,
        versionString: refreshed.data.attributes?.versionString,
        appStoreState: refreshed.data.attributes?.appStoreState,
        buildId,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e.body ?? e.message ?? e);
  process.exit(1);
});
