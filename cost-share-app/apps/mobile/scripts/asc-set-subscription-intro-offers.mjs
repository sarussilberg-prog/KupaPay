#!/usr/bin/env node
/**
 * Ensure monthly/yearly subscriptions have a FREE_TRIAL introductory offer of TWO_WEEKS
 * in every territory where the subscription is available.
 * Does NOT submit for review.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ascGetAll, ascRequest, getAscToken } from "./asc-api-client.mjs";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const metaPath = path.join(repoRoot, "store/asc/iap-metadata.json");
const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
const token = getAscToken();
const dryRun = process.argv.includes("--dry-run");

const TARGET_DURATION = "TWO_WEEKS";
const TARGET_MODE = "FREE_TRIAL";
const TARGET_PERIODS = 1;
const SUBSCRIPTION_PRODUCT_IDS = new Set(["kupapay_pro_monthly", "kupapay_pro_yearly"]);

function log(msg) {
  console.log(msg);
}

function offerMatches(offer) {
  const a = offer.attributes ?? {};
  return (
    a.offerMode === TARGET_MODE &&
    a.duration === TARGET_DURATION &&
    a.numberOfPeriods === TARGET_PERIODS
  );
}

async function listTerritoriesForSubscription(subscriptionId) {
  const sub = await ascRequest(`/v1/subscriptions/${subscriptionId}?include=subscriptionAvailability`, {
    token,
  });
  const availRef = sub.data?.relationships?.subscriptionAvailability?.data;
  if (!availRef?.id) {
    return ascGetAll("/v1/territories?limit=200", token);
  }
  const avail = await ascRequest(
    `/v1/subscriptionAvailabilities/${availRef.id}?include=availableTerritories`,
    { token },
  );
  const fromIncluded = (avail.included ?? []).filter((i) => i.type === "territories");
  if (fromIncluded.length) return fromIncluded;
  const rel = avail.data?.relationships?.availableTerritories?.data ?? [];
  if (rel.length) {
    return rel.map((t) => ({ id: t.id, type: "territories" }));
  }
  return ascGetAll("/v1/territories?limit=200", token);
}

async function listIntroOffers(subscriptionId) {
  return ascGetAll(
    `/v1/subscriptions/${subscriptionId}/introductoryOffers?include=territory&limit=200`,
    token,
  );
}

function territoryIdFromOffer(offer, includedTerritories) {
  const relId = offer.relationships?.territory?.data?.id;
  if (relId) return relId;
  return includedTerritories?.find((t) => t.id === relId)?.id ?? relId;
}

async function deleteIntroOffer(offerId) {
  if (dryRun) {
    log(`[dry-run] DELETE subscriptionIntroductoryOffers/${offerId}`);
    return;
  }
  await ascRequest(`/v1/subscriptionIntroductoryOffers/${offerId}`, { method: "DELETE", token });
}

async function createIntroOffer(subscriptionId, territoryId) {
  const body = {
    data: {
      type: "subscriptionIntroductoryOffers",
      attributes: {
        offerMode: TARGET_MODE,
        duration: TARGET_DURATION,
        numberOfPeriods: TARGET_PERIODS,
        startDate: null,
        endDate: null,
      },
      relationships: {
        subscription: { data: { type: "subscriptions", id: subscriptionId } },
        territory: { data: { type: "territories", id: territoryId } },
      },
    },
  };
  if (dryRun) {
    log(`[dry-run] POST intro offer ${subscriptionId} territory ${territoryId}`);
    return;
  }
  await ascRequest("/v1/subscriptionIntroductoryOffers", { method: "POST", token, body });
}

async function ensureSubscriptionIntroOffers(subscriptionId, productId) {
  const territories = await listTerritoriesForSubscription(subscriptionId);
  const territoryIds = [...new Set(territories.map((t) => t.id).filter(Boolean))];
  const offers = await listIntroOffers(subscriptionId);

  const offersByTerritory = new Map();
  for (const offer of offers) {
    const tid = offer.relationships?.territory?.data?.id;
    if (!tid) continue;
    const list = offersByTerritory.get(tid) ?? [];
    list.push(offer);
    offersByTerritory.set(tid, list);
  }

  let created = 0;
  let replaced = 0;
  let ok = 0;

  for (const territoryId of territoryIds) {
    const existing = offersByTerritory.get(territoryId) ?? [];
    const current = existing.find(offerMatches);
    if (current) {
      ok += 1;
      continue;
    }
    for (const offer of existing) {
      await deleteIntroOffer(offer.id);
      replaced += 1;
    }
    await createIntroOffer(subscriptionId, territoryId);
    created += 1;
  }

  return { productId, subscriptionId, territories: territoryIds.length, ok, created, replaced };
}

async function main() {
  const report = [];
  for (const product of meta.products) {
    if (!SUBSCRIPTION_PRODUCT_IDS.has(product.productId)) continue;
    if (product.kind && product.kind !== "subscription") continue;
    report.push(await ensureSubscriptionIntroOffers(product.ascId, product.productId));
  }
  console.log(JSON.stringify({ ok: true, introOffers: report }, null, 2));
}

main().catch((e) => {
  console.error(e.body ?? e.message ?? e);
  process.exit(1);
});
