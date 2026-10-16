import appConfig from '../../app.config';
import versionJson from '../../../../packages/shared/version.json';

const runConfig = (config: Record<string, unknown>): { version?: string } =>
  (appConfig as unknown as (ctx: { config: Record<string, unknown> }) => { version?: string })({ config });

const expectedMarketingVersion = (): string => {
  const raw = versionJson as { version: string; marketingVersion?: string };
  if (raw.marketingVersion?.trim()) return raw.marketingVersion.trim();
  const m = /^(\d+\.\d+\.\d+)(?:-dev\.\d+)?$/.exec(raw.version.trim());
  return m ? m[1] : raw.version;
};

describe('app.config.ts', () => {
  it('injects the store marketing version from packages/shared/version.json', () => {
    expect(runConfig({}).version).toBe(expectedMarketingVersion());
  });

  it('overrides any version already in the base config (the SSOT always wins)', () => {
    expect(runConfig({ version: '0.0.0-stale' }).version).toBe(expectedMarketingVersion());
  });
});
