import type { ConfigContext, ExpoConfig } from 'expo/config';
import versionJson from '../../packages/shared/version.json';

// app.json remains the static base for everything (icons, plugins, ios.appleTeamId,
// android intent filters, …). This dynamic config only injects the app version from
// the single source of truth (packages/shared/version.json, also exported as
// APP_VERSION from @cost-share/shared) so the native build, Constants.expoConfig.version,
// and every in-app label can never drift. The `as ExpoConfig` cast acknowledges that
// the required name/slug come from app.json via the spread — no duplicated literals.
export default ({ config }: ConfigContext): ExpoConfig =>
  ({
    ...config,
    version: versionJson.version,
  }) as ExpoConfig;
