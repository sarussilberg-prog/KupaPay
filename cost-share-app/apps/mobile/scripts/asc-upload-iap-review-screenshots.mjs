#!/usr/bin/env node
/**
 * Upload App Review paywall screenshots for Pro subscriptions and Trip Pass IAP.
 * Idempotent (re-uploads over existing). Does NOT submit for review.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ascGetAll, ascRequest, ascUploadBinary, getAscToken } from "./asc-api-client.mjs";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const appJsonPath = path.join(repoRoot, "cost-share-app/apps/mobile/app.json");
const metaPath = path.join(repoRoot, "store/asc/iap-metadata.json");
const reviewShot = path.join(repoRoot, "store/asc/review-screenshots/paywall-en-US.png");
const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));

const SUBSCRIPTION_PRODUCT_IDS = ["kupapay_pro_monthly", "kupapay_pro_yearly"];
const IAP_PRODUCT_IDS = ["kupapay_trip_pass", "trip_pass"];

const token = getAscToken();

function readBundleId() {
  const appJson = JSON.parse(fs.readFileSync(appJsonPath, "utf8"));
  const bundleId = appJson.expo?.ios?.bundleIdentifier;
  if (!bundleId) throw new Error(`Missing expo.ios.bundleIdentifier in ${appJsonPath}`);
  return bundleId;
}

async function findAppIdByBundleId(bundleId) {
  const apps = await ascGetAll(
    `/v1/apps?filter[bundleId]=${encodeURIComponent(bundleId)}&limit=5`,
    token,
  );
  const app = apps.find((a) => a.attributes?.bundleId === bundleId) ?? apps[0];
  if (!app?.id) throw new Error(`No ASC app for bundleId=${bundleId}`);
  return app.id;
}

function subscriptionAscId(productId) {
  const hit = meta.products.find((p) => p.productId === productId);
  if (!hit?.ascId) throw new Error(`Missing ascId for ${productId} in store/asc/iap-metadata.json`);
  return hit.ascId;
}

async function findSubscriptionId(productId) {
  const ascId = subscriptionAscId(productId);
  const sub = await ascRequest(`/v1/subscriptions/${ascId}`, { token });
  const wireProductId = sub.data?.attributes?.productId;
  if (wireProductId && wireProductId !== productId) {
    throw new Error(`ASC subscription ${ascId} productId mismatch: ${wireProductId} != ${productId}`);
  }
  return ascId;
}

async function findInAppPurchaseV2Id(appId) {
  for (const pid of IAP_PRODUCT_IDS) {
    const hits = await ascGetAll(
      `/v1/apps/${appId}/inAppPurchasesV2?filter[productId]=${encodeURIComponent(pid)}&limit=10`,
      token,
    );
    const iap = hits.find((h) => h.attributes?.productId === pid);
    if (iap?.id) return { id: iap.id, productId: pid };
  }
  return null;
}

async function uploadTripPassReviewScreenshot(appId, screenshotPath) {
  const iap = await findInAppPurchaseV2Id(appId);
  if (iap) {
    const upload = await uploadIapReviewScreenshot(iap.id, screenshotPath);
    return {
      productId: iap.productId,
      kind: "inAppPurchase",
      ascId: iap.id,
      upload,
    };
  }

  for (const productId of IAP_PRODUCT_IDS) {
    try {
      const subscriptionId = await findSubscriptionId(productId);
      const upload = await uploadSubscriptionReviewScreenshot(subscriptionId, screenshotPath);
      return {
        productId,
        kind: "subscription",
        ascId: subscriptionId,
        upload,
        fallback: "subscriptionAppStoreReviewScreenshots",
      };
    } catch {
      /* try next product id */
    }
  }

  throw new Error(
    `Trip Pass not found as IAP or subscription (tried ${IAP_PRODUCT_IDS.join(", ")}, app ${appId})`,
  );
}

async function uploadSubscriptionReviewScreenshot(subscriptionId, screenshotPath) {
  const existing = await ascGetAll(
    `/v1/subscriptions/${subscriptionId}/appStoreReviewScreenshots?limit=5`,
    token,
  );
  let shotId = existing[0]?.id;
  if (!shotId) {
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
    await ascUploadBinary(created.data.attributes?.uploadOperations, screenshotPath);
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
    return { action: "created", screenshotId: shotId };
  }

  const res = await ascRequest(`/v1/subscriptionAppStoreReviewScreenshots/${shotId}`, { token });
  const ops = res.data.attributes?.uploadOperations;
  if (!ops?.length) {
    return { action: "unchanged", screenshotId: shotId, note: "no_upload_operations" };
  }
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
  return { action: "replaced", screenshotId: shotId };
}

async function uploadIapReviewScreenshot(inAppPurchaseId, screenshotPath) {
  let shotId;
  try {
    const linked = await ascRequest(
      `/v1/inAppPurchasesV2/${inAppPurchaseId}/appStoreReviewScreenshot`,
      { token },
    );
    shotId = linked.data?.id;
  } catch (e) {
    if (e.status !== 404) throw e;
  }

  if (!shotId) {
    const created = await ascRequest("/v1/inAppPurchaseAppStoreReviewScreenshots", {
      method: "POST",
      token,
      body: {
        data: {
          type: "inAppPurchaseAppStoreReviewScreenshots",
          relationships: {
            inAppPurchaseV2: { data: { type: "inAppPurchases", id: inAppPurchaseId } },
          },
        },
      },
    });
    shotId = created.data.id;
    await ascUploadBinary(created.data.attributes?.uploadOperations, screenshotPath);
    await ascRequest(`/v1/inAppPurchaseAppStoreReviewScreenshots/${shotId}`, {
      method: "PATCH",
      token,
      body: {
        data: {
          type: "inAppPurchaseAppStoreReviewScreenshots",
          id: shotId,
          attributes: { uploaded: true },
        },
      },
    });
    return { action: "created", screenshotId: shotId };
  }

  const res = await ascRequest(`/v1/inAppPurchaseAppStoreReviewScreenshots/${shotId}`, { token });
  const ops = res.data.attributes?.uploadOperations;
  if (!ops?.length) {
    return { action: "unchanged", screenshotId: shotId, note: "no_upload_operations" };
  }
  await ascUploadBinary(ops, screenshotPath);
  await ascRequest(`/v1/inAppPurchaseAppStoreReviewScreenshots/${shotId}`, {
    method: "PATCH",
    token,
    body: {
      data: {
        type: "inAppPurchaseAppStoreReviewScreenshots",
        id: shotId,
        attributes: { uploaded: true },
      },
    },
  });
  return { action: "replaced", screenshotId: shotId };
}

async function main() {
  if (!fs.existsSync(reviewShot)) {
    throw new Error(`Missing paywall review screenshot: ${reviewShot}`);
  }

  const bundleId = readBundleId();
  const appId = await findAppIdByBundleId(bundleId);
  const report = { bundleId, appId, screenshot: reviewShot, products: [] };

  for (const productId of SUBSCRIPTION_PRODUCT_IDS) {
    const subscriptionId = await findSubscriptionId(productId);
    const upload = await uploadSubscriptionReviewScreenshot(subscriptionId, reviewShot);
    report.products.push({
      productId,
      kind: "subscription",
      ascId: subscriptionId,
      upload,
    });
  }

  report.products.push(await uploadTripPassReviewScreenshot(appId, reviewShot));

  console.log(JSON.stringify({ ok: true, ...report }, null, 2));
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: e.body ?? e.message ?? String(e) }, null, 2));
  process.exit(1);
});
