#!/usr/bin/env node
/**
 * Submit the prepared iOS app version to App Store review (ASC API).
 * Expects asc-prepare-app-version.mjs to have attached a VALID build.
 */
import { ascConfig } from './asc-api-common.mjs';
import { ascGetAll, ascRequest, getAscToken } from './asc-api-client.mjs';

const { appId } = ascConfig();
const token = getAscToken();
const dryRun = process.argv.includes('--dry-run');
const versionString = process.argv.find((a) => /^\d+\.\d+\.\d+$/.test(a));

async function findVersion() {
  const versions = await ascGetAll(
    `/v1/apps/${appId}/appStoreVersions?filter[platform]=IOS&limit=30`,
    token,
  );
  if (versionString) {
    const hit = versions.find((v) => v.attributes?.versionString === versionString);
    if (!hit) throw new Error(`app_store_version_not_found:${versionString}`);
    return hit;
  }
  const ready = versions.find((v) =>
    ['PREPARE_FOR_SUBMISSION', 'READY_FOR_SUBMISSION', 'DEVELOPER_REJECTED', 'REJECTED'].includes(
      v.attributes?.appStoreState ?? '',
    ),
  );
  if (!ready) throw new Error('no_app_store_version_ready_for_submission');
  return ready;
}

async function main() {
  const version = await findVersion();
  const versionId = version.id;
  const state = version.attributes?.appStoreState;
  if (state === 'WAITING_FOR_REVIEW' || state === 'IN_REVIEW') {
    console.log(JSON.stringify({ ok: true, alreadySubmitted: true, versionId, appStoreState: state }));
    return;
  }
  if (dryRun) {
    console.log(JSON.stringify({ ok: true, dryRun: true, versionId, appStoreState: state }));
    return;
  }
  const res = await ascRequest('/v1/appStoreVersionSubmissions', {
    method: 'POST',
    token,
    body: {
      data: {
        type: 'appStoreVersionSubmissions',
        relationships: {
          appStoreVersion: { data: { type: 'appStoreVersions', id: versionId } },
        },
      },
    },
  });
  console.log(
    JSON.stringify({
      ok: true,
      submissionId: res.data?.id,
      versionId,
      appStoreState: state,
    }),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
