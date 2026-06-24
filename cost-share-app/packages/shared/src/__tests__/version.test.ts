import { APP_VERSION } from '../index';
import { APP_VERSION as APP_VERSION_FROM_MODULE } from '../version';

describe('APP_VERSION', () => {
  it('is a valid semver string', () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('is re-exported unchanged from the package barrel', () => {
    expect(APP_VERSION).toBe(APP_VERSION_FROM_MODULE);
  });
});
