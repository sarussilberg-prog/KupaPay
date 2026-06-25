import appConfig from '../../app.config';
import versionJson from '../../../../packages/shared/version.json';

const runConfig = (config: Record<string, unknown>): { version?: string } =>
  (appConfig as unknown as (ctx: { config: Record<string, unknown> }) => { version?: string })({ config });

describe('app.config.ts', () => {
  it('injects the SSOT app version from packages/shared/version.json', () => {
    expect(runConfig({}).version).toBe(versionJson.version);
  });

  it('overrides any version already in the base config (the SSOT always wins)', () => {
    expect(runConfig({ version: '0.0.0-stale' }).version).toBe(versionJson.version);
  });
});
