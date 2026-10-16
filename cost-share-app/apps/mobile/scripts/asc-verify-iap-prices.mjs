#!/usr/bin/env node
/**
 * Verify Israel (ILS) subscription prices match expected VAT-inclusive amounts.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ascGetAll, ascRequest, getAscToken } from "./asc-api-client.mjs";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const meta = JSON.parse(fs.readFileSync(path.join(repoRoot, "store/asc/iap-metadata.json"), "utf8"));
const token = getAscToken();

const ILS_TERRITORY = "ISR";

async function priceForSubscription(subscriptionId) {
  const prices = await ascGetAll(
    `/v1/subscriptions/${subscriptionId}/prices?include=subscriptionPricePoint,territory&limit=50`,
    token,
  );
  const included = await ascRequest(
    `/v1/subscriptions/${subscriptionId}/prices?include=subscriptionPricePoint,territory&limit=50`,
    { token },
  );
  const pricePoints = new Map(
    (included.included ?? [])
      .filter((i) => i.type === "subscriptionPricePoints")
      .map((p) => [p.id, p]),
  );
  const territories = new Map(
    (included.included ?? []).filter((i) => i.type === "territories").map((t) => [t.id, t]),
  );

  for (const price of prices) {
    const territoryRel = price.relationships?.territory?.data?.id;
    const territory = territories.get(territoryRel);
    if (territory?.attributes?.currency !== "ILS") continue;
    const pointId = price.relationships?.subscriptionPricePoint?.data?.id;
    const point = pricePoints.get(pointId);
    const customerPrice = point?.attributes?.customerPrice;
    return customerPrice != null ? Number(customerPrice) : null;
  }
  return null;
}

const results = [];
for (const p of meta.products) {
  const actual = await priceForSubscription(p.ascId);
  const ok = actual != null && Math.abs(actual - p.expectedPriceILS) < 0.02;
  results.push({
    productId: p.productId,
    expectedILS: p.expectedPriceILS,
    actualILS: actual,
    ok,
  });
}

console.log(JSON.stringify({ results, allOk: results.every((r) => r.ok) }, null, 2));
if (!results.every((r) => r.ok)) process.exit(1);
