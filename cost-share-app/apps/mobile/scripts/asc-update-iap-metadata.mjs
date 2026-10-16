#!/usr/bin/env node
/**
 * Fill subscription IAP localizations, review notes, and paywall review screenshots.
 * Does NOT submit for review.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ascConfig } from "./asc-api-common.mjs";
import { ascGetAll, ascRequest, ascUploadBinary, getAscToken } from "./asc-api-client.mjs";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const metaPath = path.join(repoRoot, "store/asc/iap-metadata.json");
const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
const token = getAscToken();
const dryRun = process.argv.includes("--dry-run");

function log(msg) {
  console.log(msg);
}

async function upsertSubscriptionLocalization(subscriptionId, locale, name, description) {
  const existing = await ascGetAll(
    `/v1/subscriptions/${subscriptionId}/subscriptionLocalizations?filter[locale]=${encodeURIComponent(locale)}&limit=5`,
    token,
  );
  const hit = existing.find((e) => e.attributes?.locale === locale);
  if (hit) {
    if (dryRun) {
      log(`[dry-run] PATCH subscriptionLocalization ${hit.id} ${locale}`);
      return hit.id;
    }
    await ascRequest(`/v1/subscriptionLocalizations/${hit.id}`, {
      method: "PATCH",
      token,
      body: {
        data: {
          type: "subscriptionLocalizations",
          id: hit.id,
          attributes: { name, description },
        },
      },
    });
    return hit.id;
  }
  if (dryRun) {
    log(`[dry-run] POST subscriptionLocalization ${subscriptionId} ${locale}`);
    return null;
  }
  const created = await ascRequest("/v1/subscriptionLocalizations", {
    method: "POST",
    token,
    body: {
      data: {
        type: "subscriptionLocalizations",
        attributes: { locale, name, description },
        relationships: {
          subscription: { data: { type: "subscriptions", id: subscriptionId } },
        },
      },
    },
  });
  return created.data.id;
}

async function ensureReviewScreenshot(subscriptionId, screenshotPath) {
  const existing = await ascGetAll(
    `/v1/subscriptions/${subscriptionId}/appStoreReviewScreenshots?limit=5`,
    token,
  );
  let shotId = existing[0]?.id;
  if (!shotId && !dryRun) {
    const created = await ascRequest("/v1/subscriptionAppStoreReviewScreenshots", {
      method: "POST",
      token,
      body: {
        data: {
          type: "subscriptionAppStoreReviewScreenshots",
          relationships: {
            subscription: { data: { type: "subscriptions", id: subscriptionId } },
          },
        },
      },
    });
    shotId = created.data.id;
    const ops = created.data.attributes?.uploadOperations;
    await ascUploadBinary(ops, screenshotPath);
    await ascRequest(`/v1/subscriptionAppStoreReviewScreenshots/${shotId}`, {
      method: "PATCH",
      token,
      body: {
        data: {
          type: "subscriptionAppStoreReviewScreenshots",
          id: shotId,
          attributes: { uploaded: true },
        },
      },
    });
    log(`Uploaded review screenshot for subscription ${subscriptionId}`);
    return;
  }
  if (dryRun) {
    log(`[dry-run] review screenshot for ${subscriptionId} ← ${screenshotPath}`);
    return;
  }
  if (shotId) {
    const res = await ascRequest(`/v1/subscriptionAppStoreReviewScreenshots/${shotId}`, { token });
    const ops = res.data.attributes?.uploadOperations;
    if (ops?.length) {
      await ascUploadBinary(ops, screenshotPath);
      await ascRequest(`/v1/subscriptionAppStoreReviewScreenshots/${shotId}`, {
        method: "PATCH",
        token,
        body: {
          data: {
            type: "subscriptionAppStoreReviewScreenshots",
            id: shotId,
            attributes: { uploaded: true },
          },
        },
      });
      log(`Re-uploaded review screenshot for subscription ${subscriptionId}`);
    }
  }
}

async function setReviewNotes(subscriptionId, notes) {
  const details = await ascGetAll(`/v1/subscriptions/${subscriptionId}/appStoreReviewDetails?limit=1`, token);
  if (details[0]?.id) {
    if (dryRun) {
      log(`[dry-run] PATCH review notes ${subscriptionId}`);
      return;
    }
    await ascRequest(`/v1/subscriptionAppStoreReviewDetails/${details[0].id}`, {
      method: "PATCH",
      token,
      body: {
        data: {
          type: "subscriptionAppStoreReviewDetails",
          id: details[0].id,
          attributes: { reviewNotes: notes },
        },
      },
    });
    return;
  }
  if (dryRun) {
    log(`[dry-run] POST review notes ${subscriptionId}`);
    return;
  }
  await ascRequest("/v1/subscriptionAppStoreReviewDetails", {
    method: "POST",
    token,
    body: {
      data: {
        type: "subscriptionAppStoreReviewDetails",
        attributes: { reviewNotes: notes },
        relationships: {
          subscription: { data: { type: "subscriptions", id: subscriptionId } },
        },
      },
    },
  });
}

async function main() {
  const reviewShot = path.join(repoRoot, "store/asc/review-screenshots/paywall-en-US.png");
  if (!fs.existsSync(reviewShot) && !dryRun) {
    throw new Error(`Missing paywall review screenshot: ${reviewShot} (run generate-iap-review-screenshot.mjs)`);
  }

  const report = [];
  for (const product of meta.products) {
    const { ascId, productId } = product;
    for (const locale of meta.ascLocales) {
      const loc = meta.localizations[locale]?.[productId];
      if (!loc) throw new Error(`Missing localization ${locale}/${productId}`);
      await upsertSubscriptionLocalization(ascId, locale, loc.name, loc.description);
    }
    await setReviewNotes(ascId, meta.reviewNotes);
    if (fs.existsSync(reviewShot)) {
      await ensureReviewScreenshot(ascId, reviewShot);
    }
    const sub = await ascRequest(`/v1/subscriptions/${ascId}`, { token });
    report.push({
      productId,
      ascId,
      state: sub.data.attributes?.state,
      productIdAttr: sub.data.attributes?.productId,
    });
  }

  console.log(JSON.stringify({ ok: true, subscriptions: report }, null, 2));
}

main().catch((e) => {
  console.error(e.body ?? e.message ?? e);
  process.exit(1);
});
