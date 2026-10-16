/**
 * Set EAS remote iOS buildNumber via Expo GraphQL (non-interactive; works on eas-cli 24.12.x).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const EXPO_GRAPHQL = "https://api.expo.dev/graphql";
const mobileDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function readProjectId() {
  const appJson = JSON.parse(fs.readFileSync(path.join(mobileDir, "app.json"), "utf8"));
  const projectId = appJson.expo?.extra?.eas?.projectId;
  if (!projectId) throw new Error("expo.extra.eas.projectId missing in app.json");
  return projectId;
}

function readStoreVersion() {
  const versionJson = JSON.parse(
    fs.readFileSync(path.join(mobileDir, "../../packages/shared/version.json"), "utf8"),
  );
  const marketing = versionJson.marketingVersion?.trim();
  if (marketing) return marketing;
  if (!versionJson.version) throw new Error("packages/shared/version.json missing version");
  const m = /^(\d+\.\d+\.\d+)(?:-dev\.\d+)?$/.exec(String(versionJson.version).trim());
  return m ? m[1] : versionJson.version;
}

function readBundleIdentifier() {
  const appJson = JSON.parse(fs.readFileSync(path.join(mobileDir, "app.json"), "utf8"));
  const id = appJson.expo?.ios?.bundleIdentifier;
  if (!id) throw new Error("expo.ios.bundleIdentifier missing in app.json");
  return id;
}

async function expoGraphql(query, variables) {
  const token = process.env.EXPO_TOKEN?.trim();
  if (!token) throw new Error("EXPO_TOKEN is required");
  const res = await fetch(EXPO_GRAPHQL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (!res.ok || json.errors?.length) {
    throw new Error(JSON.stringify(json.errors ?? json));
  }
  return json.data;
}

export async function getRemoteIosBuildNumber() {
  const data = await expoGraphql(
    `query LatestAppVersion($appId: String!, $platform: AppPlatform!, $applicationIdentifier: String!) {
      app {
        byId(appId: $appId) {
          latestAppVersionByPlatformAndApplicationIdentifier(
            platform: $platform
            applicationIdentifier: $applicationIdentifier
          ) {
            buildVersion
          }
        }
      }
    }`,
    {
      appId: readProjectId(),
      platform: "IOS",
      applicationIdentifier: readBundleIdentifier(),
    },
  );
  return data.app?.byId?.latestAppVersionByPlatformAndApplicationIdentifier?.buildVersion ?? null;
}

/** @param {string} buildVersion numeric string for next build after autoIncrement baseline */
export async function setRemoteIosBuildNumber(buildVersion) {
  const build = String(buildVersion).trim();
  if (!/^\d+$/.test(build)) {
    throw new Error(`invalid ios buildNumber (digits only): ${build}`);
  }
  await expoGraphql(
    `mutation CreateAppVersion($appVersionInput: AppVersionInput!) {
      appVersion {
        createAppVersion(appVersionInput: $appVersionInput) { id }
      }
    }`,
    {
      appVersionInput: {
        appId: readProjectId(),
        platform: "IOS",
        applicationIdentifier: readBundleIdentifier(),
        storeVersion: readStoreVersion(),
        buildVersion: build,
      },
    },
  );
  return build;
}
