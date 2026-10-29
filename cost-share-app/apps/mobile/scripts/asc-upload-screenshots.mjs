#!/usr/bin/env node
/**
 * Upload store/screenshots/ios/<locale>/*.png to the editable App Store version.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ascConfig } from "./asc-api-common.mjs";
import { ascGetAll, ascRequest, ascUploadBinary, getAscToken } from "./asc-api-client.mjs";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const shotsRoot = path.join(repoRoot, "store/screenshots/ios");
const { appId } = ascConfig();
const token = getAscToken();
const dryRun = process.argv.includes("--dry-run");

/** Map folder suffix to ASC screenshot display type. */
const DISPLAY_BY_FOLDER = {
  // ASC has no APP_IPHONE_69; 6.9" (1320x2868) shots go in the APP_IPHONE_67 set. 6.7 folder is skipped (same set).
  "6.9": "APP_IPHONE_67",
  "6.5": "APP_IPHONE_65",
  ipad: "APP_IPAD_PRO_3GEN_129",
};

async function editableVersionId() {
  const versions = await ascGetAll(
    `/v1/apps/${appId}/appStoreVersions?filter[platform]=IOS&limit=20`,
    token,
  );
  const v = versions.find((x) => x.attributes?.appStoreState === "PREPARE_FOR_SUBMISSION");
  if (!v) throw new Error("no_prepare_for_submission_version");
  return v.id;
}

async function localizationId(versionId, locale) {
  const locs = await ascGetAll(
    `/v1/appStoreVersions/${versionId}/appStoreVersionLocalizations?limit=50`,
    token,
  );
  let hit = locs.find((l) => l.attributes?.locale === locale);
  if (!hit && !dryRun) {
    const created = await ascRequest("/v1/appStoreVersionLocalizations", {
      method: "POST",
      token,
      body: {
        data: {
          type: "appStoreVersionLocalizations",
          attributes: { locale },
          relationships: {
            appStoreVersion: { data: { type: "appStoreVersions", id: versionId } },
          },
        },
      },
    });
    hit = created.data;
  }
  return hit?.id;
}

async function screenshotSetId(localizationId, displayType) {
  const sets = await ascGetAll(
    `/v1/appStoreVersionLocalizations/${localizationId}/appScreenshotSets?limit=20`,
    token,
  );
  let hit = sets.find((s) => s.attributes?.screenshotDisplayType === displayType);
  if (!hit && !dryRun) {
    const created = await ascRequest("/v1/appScreenshotSets", {
      method: "POST",
      token,
      body: {
        data: {
          type: "appScreenshotSets",
          attributes: { screenshotDisplayType: displayType },
          relationships: {
            appStoreVersionLocalization: {
              data: { type: "appStoreVersionLocalizations", id: localizationId },
            },
          },
        },
      },
    });
    hit = created.data;
  }
  return hit?.id;
}

/** Replace, not append: remove existing screenshots in the set (ASC caps a set at 10). */
async function clearScreenshotSet(setId) {
  if (dryRun || !setId) return;
  const existing = await ascGetAll(`/v1/appScreenshotSets/${setId}/appScreenshots?limit=50`, token);
  for (const shot of existing) {
    await ascRequest(`/v1/appScreenshots/${shot.id}`, { method: "DELETE", token });
  }
}

async function uploadScreenshot(setId, filePath) {
  if (dryRun) {
    console.log(`[dry-run] upload ${filePath} → set ${setId}`);
    return;
  }
  const created = await ascRequest("/v1/appScreenshots", {
    method: "POST",
    token,
    body: {
      data: {
        type: "appScreenshots",
        attributes: { fileName: path.basename(filePath), fileSize: fs.statSync(filePath).size },
        relationships: {
          appScreenshotSet: { data: { type: "appScreenshotSets", id: setId } },
        },
      },
    },
  });
  const shotId = created.data.id;
  await ascUploadBinary(created.data.attributes?.uploadOperations, filePath);
  await ascRequest(`/v1/appScreenshots/${shotId}`, {
    method: "PATCH",
    token,
    body: {
      data: { type: "appScreenshots", id: shotId, attributes: {
        uploaded: true,
        sourceFileChecksum: crypto.createHash("md5").update(fs.readFileSync(filePath)).digest("hex"),
      } },
    },
  });
}

async function main() {
  const versionId = await editableVersionId();
  const uploaded = [];

  for (const locale of fs.readdirSync(shotsRoot)) {
    const localeDir = path.join(shotsRoot, locale);
    if (!fs.statSync(localeDir).isDirectory()) continue;
    const locId = await localizationId(versionId, locale);
    if (!locId) continue;

    for (const sizeFolder of fs.readdirSync(localeDir)) {
      const displayType = DISPLAY_BY_FOLDER[sizeFolder];
      if (!displayType) continue;
      const dir = path.join(localeDir, sizeFolder);
      if (!fs.statSync(dir).isDirectory()) continue;
      const setId = await screenshotSetId(locId, displayType);
      await clearScreenshotSet(setId);
      const files = fs
        .readdirSync(dir)
        .filter((f) => f.endsWith(".png"))
        .sort()
        .slice(0, 10);
      for (const f of files) {
        await uploadScreenshot(setId, path.join(dir, f));
        uploaded.push(`${locale}/${sizeFolder}/${f}`);
      }
    }
  }

  console.log(JSON.stringify({ ok: true, versionId, uploadedCount: uploaded.length, uploaded }, null, 2));
}

main().catch((e) => {
  console.error(e.body ?? e.message ?? e);
  process.exit(1);
});
