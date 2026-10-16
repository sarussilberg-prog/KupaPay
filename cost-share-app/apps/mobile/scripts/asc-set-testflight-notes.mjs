#!/usr/bin/env node
/**
 * Set TestFlight "What to Test" (beta build localization whatsNew) for a build number.
 * Usage: node asc-set-testflight-notes.mjs <buildNumber> [notesText]
 */
import fs from 'node:fs';
import { ascConfig, createAscJwt, fetchAscBuilds } from './asc-api-common.mjs';

const buildNumber = Math.floor(Number(process.argv[2] ?? process.env.MIN_BUILD ?? '0'));
let notes = process.argv.slice(3).join(' ').trim();
if (!notes && process.env.TESTFLIGHT_NOTES_PATH && fs.existsSync(process.env.TESTFLIGHT_NOTES_PATH)) {
  notes = fs.readFileSync(process.env.TESTFLIGHT_NOTES_PATH, 'utf8').trim();
}

if (!buildNumber || !notes.trim()) {
  console.error('Usage: asc-set-testflight-notes.mjs <buildNumber> <notes>');
  process.exit(1);
}

const { keyPath, keyId, issuerId, appId } = ascConfig();
const token = createAscJwt(keyPath, keyId, issuerId);

async function ascJson(method, urlPath, body) {
  const res = await fetch(`https://api.appstoreconnect.apple.com${urlPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(json));
  return json;
}

const builds = await fetchAscBuilds(appId, token, 30);
const build = builds.find(b => Number(b.attributes?.version) === buildNumber);
if (!build?.id) {
  console.error(`No ASC build with version ${buildNumber}`);
  process.exit(1);
}

const buildId = build.id;
const locs = await ascJson('GET', `/v1/builds/${buildId}/betaBuildLocalizations?limit=10`);
const en =
  locs.data?.find(l => l.attributes?.locale === 'en-US') ??
  locs.data?.find(l => l.attributes?.locale?.startsWith('en'));

const whatsNew = notes.trim().slice(0, 4000);

if (en?.id) {
  await ascJson('PATCH', `/v1/betaBuildLocalizations/${en.id}`, {
    data: {
      type: 'betaBuildLocalizations',
      id: en.id,
      attributes: { whatsNew },
    },
  });
  console.log('Updated TestFlight whatsNew for build', buildNumber);
} else {
  await ascJson('POST', '/v1/betaBuildLocalizations', {
    data: {
      type: 'betaBuildLocalizations',
      attributes: { locale: 'en-US', whatsNew },
      relationships: {
        build: { data: { type: 'builds', id: buildId } },
      },
    },
  });
  console.log('Created TestFlight whatsNew for build', buildNumber);
}
