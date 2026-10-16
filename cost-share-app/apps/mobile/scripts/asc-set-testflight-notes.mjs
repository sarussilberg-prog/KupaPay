#!/usr/bin/env node
/**
 * Set TestFlight "What to Test" (beta build localization whatsNew) for a build number.
 * Usage: node asc-set-testflight-notes.mjs <buildNumber> [notesText]
 */
import fs from 'node:fs';
import { ascConfig, createAscJwt, fetchAscBuilds } from './asc-api-common.mjs';

const ASC_API = 'https://api.appstoreconnect.apple.com';
const ASC_RESOURCE_ID_RE = /^[0-9A-Za-z-]{8,128}$/;

const buildNumber = Math.floor(Number(process.argv[2] ?? process.env.MIN_BUILD ?? '0'));
let notes = process.argv.slice(3).join(' ').trim();
if (!notes && process.env.TESTFLIGHT_NOTES_PATH && fs.existsSync(process.env.TESTFLIGHT_NOTES_PATH)) {
  notes = fs.readFileSync(process.env.TESTFLIGHT_NOTES_PATH, 'utf8').trim();
}

if (!buildNumber || !notes.trim()) {
  console.error('Usage: asc-set-testflight-notes.mjs <buildNumber> <notes>');
  process.exit(1);
}

function assertAscResourceId(id, label) {
  const value = String(id ?? '').trim();
  if (!ASC_RESOURCE_ID_RE.test(value)) {
    throw new Error(`Invalid App Store Connect ${label} id`);
  }
  return value;
}

async function ascRequest(method, url, body) {
  const res = await fetch(url, {
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

const { keyPath, keyId, issuerId, appId } = ascConfig();
const token = createAscJwt(keyPath, keyId, issuerId);

const builds = await fetchAscBuilds(appId, token, 30);
const build = builds.find(b => Number(b.attributes?.version) === buildNumber);
if (!build?.id) {
  console.error(`No ASC build with version ${buildNumber}`);
  process.exit(1);
}

const buildId = assertAscResourceId(build.id, 'build');
const locs = await ascRequest(
  'GET',
  `${ASC_API}/v1/builds/${buildId}/betaBuildLocalizations?limit=10`,
);
const en =
  locs.data?.find(l => l.attributes?.locale === 'en-US') ??
  locs.data?.find(l => l.attributes?.locale?.startsWith('en'));

const whatsNew = notes.trim().slice(0, 4000);

if (en?.id) {
  const localizationId = assertAscResourceId(en.id, 'betaBuildLocalization');
  await ascRequest('PATCH', `${ASC_API}/v1/betaBuildLocalizations/${localizationId}`, {
    data: {
      type: 'betaBuildLocalizations',
      id: localizationId,
      attributes: { whatsNew },
    },
  });
  console.log('Updated TestFlight whatsNew for build', buildNumber);
} else {
  await ascRequest('POST', `${ASC_API}/v1/betaBuildLocalizations`, {
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
